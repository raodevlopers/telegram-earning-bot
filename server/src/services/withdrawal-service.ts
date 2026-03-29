import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { PayoutType, UserRecord, WalletTransactionRecord, WithdrawalRecord } from "../../../shared/src/types.js";
import { platformStatsRef, userRef, walletTransactionRef, withdrawalRef, withdrawalsCollection } from "../data/refs.js";
import { AppError } from "../utils/errors.js";
import { nowIso } from "../utils/time.js";

export class WithdrawalService {
  constructor(
    private readonly db: Firestore,
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {}

  async createWithdrawalRequest(userId: string, payoutType: PayoutType, payoutValue: string) {
    const result = await this.db.runTransaction(async (transaction) => {
      const timestamp = nowIso();
      const userSnapshot = await transaction.get(userRef(this.db, userId));

      if (!userSnapshot.exists) {
        throw new AppError(404, "user_not_found", "User not found.");
      }

      const user = userSnapshot.data() as UserRecord;
      if (user.pendingWithdrawalId) {
        throw new AppError(400, "withdrawal_pending", "You already have a pending withdrawal request.");
      }

      if (user.balancePaise < this.config.rewards.minWithdrawalPaise) {
        throw new AppError(400, "withdrawal_minimum", "Minimum withdrawal balance has not been reached yet.");
      }

      const withdrawalId = `wd_${nanoid(10)}`;
      const amountPaise = user.balancePaise;
      const nextBalance = user.balancePaise - amountPaise;
      const withdrawal: WithdrawalRecord = {
        id: withdrawalId,
        userId,
        username: user.username,
        displayName: user.displayName,
        amountPaise,
        payoutType,
        payoutValue,
        status: "pending",
        requestedAt: timestamp,
        reviewedAt: null,
        reviewedBy: null,
        adminNote: null
      };

      transaction.set(withdrawalRef(this.db, withdrawalId), withdrawal);
      transaction.set(
        userRef(this.db, userId),
        {
          balancePaise: nextBalance,
          pendingWithdrawalId: withdrawalId,
          botState: null,
          updatedAt: timestamp,
          lastActiveAt: timestamp
        },
        { merge: true }
      );
      transaction.set(
        walletTransactionRef(this.db, `withdrawal_hold_${withdrawalId}`),
        this.createWalletRecord({
          id: `withdrawal_hold_${withdrawalId}`,
          userId,
          amountPaise: -amountPaise,
          balanceAfterPaise: nextBalance,
          referenceType: "withdrawal",
          referenceId: withdrawalId,
          type: "withdrawal_hold",
          createdAt: timestamp
        })
      );
      transaction.set(
        platformStatsRef(this.db),
        {
          id: "platform",
          pendingWithdrawalCount: FieldValue.increment(1),
          updatedAt: timestamp
        },
        { merge: true }
      );

      return withdrawal;
    });

    this.logger.info({ userId, withdrawalId: result.id }, "withdrawal_created");
    return result;
  }

  async approveWithdrawal(withdrawalId: string, reviewedBy: string, adminNote: string | null) {
    return this.db.runTransaction(async (transaction) => {
      const timestamp = nowIso();
      const withdrawalSnapshot = await transaction.get(withdrawalRef(this.db, withdrawalId));

      if (!withdrawalSnapshot.exists) {
        throw new AppError(404, "withdrawal_not_found", "Withdrawal not found.");
      }

      const withdrawal = withdrawalSnapshot.data() as WithdrawalRecord;
      if (withdrawal.status !== "pending") {
        throw new AppError(400, "withdrawal_not_pending", "Withdrawal has already been reviewed.");
      }

      transaction.set(
        withdrawalRef(this.db, withdrawalId),
        {
          status: "approved",
          reviewedAt: timestamp,
          reviewedBy,
          adminNote
        },
        { merge: true }
      );
      transaction.set(
        userRef(this.db, withdrawal.userId),
        {
          pendingWithdrawalId: null,
          updatedAt: timestamp
        },
        { merge: true }
      );
      transaction.set(
        platformStatsRef(this.db),
        {
          id: "platform",
          pendingWithdrawalCount: FieldValue.increment(-1),
          approvedWithdrawalCount: FieldValue.increment(1),
          totalWithdrawnPaise: FieldValue.increment(withdrawal.amountPaise),
          updatedAt: timestamp
        },
        { merge: true }
      );

      const approved: WithdrawalRecord = {
        ...withdrawal,
        status: "approved",
        reviewedAt: timestamp,
        reviewedBy,
        adminNote
      };

      this.logger.info({ withdrawalId, reviewedBy }, "withdrawal_approved");
      return approved;
    });
  }

  async rejectWithdrawal(withdrawalId: string, reviewedBy: string, adminNote: string | null) {
    return this.db.runTransaction(async (transaction) => {
      const timestamp = nowIso();
      const withdrawalSnapshot = await transaction.get(withdrawalRef(this.db, withdrawalId));

      if (!withdrawalSnapshot.exists) {
        throw new AppError(404, "withdrawal_not_found", "Withdrawal not found.");
      }

      const withdrawal = withdrawalSnapshot.data() as WithdrawalRecord;
      if (withdrawal.status !== "pending") {
        throw new AppError(400, "withdrawal_not_pending", "Withdrawal has already been reviewed.");
      }

      const userSnapshot = await transaction.get(userRef(this.db, withdrawal.userId));
      if (!userSnapshot.exists) {
        throw new AppError(404, "user_not_found", "User not found.");
      }

      const user = userSnapshot.data() as UserRecord;
      const refundTxRef = walletTransactionRef(this.db, `withdrawal_refund_${withdrawalId}`);
      const existingRefund = await transaction.get(refundTxRef);

      if (!existingRefund.exists) {
        const nextBalance = user.balancePaise + withdrawal.amountPaise;
        transaction.set(
          userRef(this.db, withdrawal.userId),
          {
            balancePaise: nextBalance,
            pendingWithdrawalId: null,
            updatedAt: timestamp,
            lastActiveAt: timestamp
          },
          { merge: true }
        );
        transaction.set(
          refundTxRef,
          this.createWalletRecord({
            id: `withdrawal_refund_${withdrawalId}`,
            userId: withdrawal.userId,
            amountPaise: withdrawal.amountPaise,
            balanceAfterPaise: nextBalance,
            referenceType: "withdrawal",
            referenceId: withdrawalId,
            type: "withdrawal_refund",
            createdAt: timestamp
          })
        );
      }

      transaction.set(
        withdrawalRef(this.db, withdrawalId),
        {
          status: "rejected",
          reviewedAt: timestamp,
          reviewedBy,
          adminNote
        },
        { merge: true }
      );
      transaction.set(
        platformStatsRef(this.db),
        {
          id: "platform",
          pendingWithdrawalCount: FieldValue.increment(-1),
          rejectedWithdrawalCount: FieldValue.increment(1),
          updatedAt: timestamp
        },
        { merge: true }
      );

      const rejected: WithdrawalRecord = {
        ...withdrawal,
        status: "rejected",
        reviewedAt: timestamp,
        reviewedBy,
        adminNote
      };

      this.logger.info({ withdrawalId, reviewedBy }, "withdrawal_rejected");
      return rejected;
    });
  }

  async listRecentWithdrawals() {
    const snapshot = await withdrawalsCollection(this.db).orderBy("requestedAt", "desc").limit(200).get();
    return snapshot.docs.map((doc) => doc.data() as WithdrawalRecord);
  }

  private createWalletRecord(record: WalletTransactionRecord) {
    return record;
  }
}
