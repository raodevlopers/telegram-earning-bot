import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { BotState, ReferralRecord, TelegramProfile, UserRecord } from "../../../shared/src/types.js";
import { RISK_FLAGS } from "../../../shared/src/constants.js";
import { referralRef, referralsCollection, userRef } from "../data/refs.js";
import { AppError } from "../utils/errors.js";
import { nowIso, sortByNewest } from "../utils/time.js";
import { buildDisplayName } from "../../../shared/src/format.js";
import { buildReferralCode } from "../../../shared/src/validators.js";

export class UserService {
  constructor(
    private readonly db: Firestore,
    private readonly _config: AppConfig,
    private readonly logger: Logger
  ) {}

  async registerOrGetTelegramUser(profile: TelegramProfile, referredBy: string | null) {
    const user = await this.db.runTransaction(async (transaction) => {
      const timestamp = nowIso();
      const currentUserRef = userRef(this.db, profile.id);
      const currentUserSnapshot = await transaction.get(currentUserRef);

      if (!currentUserSnapshot.exists) {
        const referrerId = await this.resolveReferrer(transaction, profile.id, referredBy);
        const riskFlags: string[] = [];
        if (referredBy === profile.id) {
          riskFlags.push(RISK_FLAGS.selfReferralAttempt);
        } else if (referredBy && !referrerId) {
          riskFlags.push(RISK_FLAGS.invalidReferrer);
        }

        const userRecord: UserRecord = {
          id: profile.id,
          telegramId: profile.id,
          username: profile.username,
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName: buildDisplayName(profile),
          balancePaise: 0,
          referralCode: buildReferralCode(profile.id),
          referredBy: referrerId,
          firstTaskCompletedAt: null,
          completedTaskCount: 0,
          taskEarningsPaise: 0,
          referralCount: 0,
          referralEarningsPaise: 0,
          pendingWithdrawalId: null,
          riskFlags,
          botState: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          lastActiveAt: timestamp
        };

        transaction.set(currentUserRef, userRecord);

        if (referrerId) {
          const referralRecord: ReferralRecord = {
            id: `${referrerId}_${profile.id}`,
            referrerId,
            referredId: profile.id,
            rewardGranted: false,
            rewardedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp
          };
          transaction.set(referralRef(this.db, referralRecord.id), referralRecord);
        }

        return userRecord;
      }

      const existing = currentUserSnapshot.data() as UserRecord;
      const riskFlags = [...existing.riskFlags];
      if (referredBy === profile.id && !riskFlags.includes(RISK_FLAGS.selfReferralAttempt)) {
        riskFlags.push(RISK_FLAGS.selfReferralAttempt);
      }
      if (referredBy && referredBy !== profile.id) {
        const referrerId = await this.resolveReferrer(transaction, profile.id, referredBy);
        if (!referrerId && !riskFlags.includes(RISK_FLAGS.invalidReferrer)) {
          riskFlags.push(RISK_FLAGS.invalidReferrer);
        }
      }

      const nextUser: UserRecord = {
        ...existing,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: buildDisplayName(profile),
        riskFlags,
        updatedAt: timestamp,
        lastActiveAt: timestamp
      };

      transaction.set(currentUserRef, nextUser);
      return nextUser;
    });

    this.logger.info({ userId: user.id }, "telegram_user_ready");
    return user;
  }

  async getUser(userId: string): Promise<UserRecord> {
    const snapshot = await userRef(this.db, userId).get();
    if (!snapshot.exists) {
      throw new AppError(404, "user_not_found", "User not found.");
    }

    return snapshot.data() as UserRecord;
  }

  async setBotState(userId: string, botState: BotState | null) {
    await userRef(this.db, userId).set(
      {
        botState,
        updatedAt: nowIso()
      },
      { merge: true }
    );
  }

  async getReferralSummary(userId: string) {
    const snapshot = await referralsCollection(this.db).where("referrerId", "==", userId).get();
    const referrals = snapshot.docs.map((doc) => doc.data() as ReferralRecord);

    return {
      totalReferrals: referrals.length,
      rewardedReferrals: referrals.filter((entry) => entry.rewardGranted).length,
      pendingReferrals: referrals.filter((entry) => !entry.rewardGranted).length,
      recent: sortByNewest(referrals, "createdAt").slice(0, 5)
    };
  }

  private async resolveReferrer(transaction: Transaction, currentUserId: string, referredBy: string | null) {
    if (!referredBy || referredBy === currentUserId) {
      return null;
    }

    const referrerSnapshot = await transaction.get(userRef(this.db, referredBy));
    if (!referrerSnapshot.exists) {
      return null;
    }

    return referredBy;
  }
}
