import type { Firestore } from "firebase-admin/firestore";
import type { Logger } from "pino";
import type {
  AdminOverview,
  CompletedTaskInsightRecord,
  PlatformStatsRecord,
  ReferralInsightRecord,
  ReferralRecord,
  TaskCompletionRecord,
  TaskRecord,
  UserDetailResponse,
  UserRecord,
  WalletTransactionRecord,
  WithdrawalRecord
} from "../../../shared/src/types.js";
import {
  platformStatsRef,
  referralsCollection,
  taskCompletionsCollection,
  tasksCollection,
  userRef,
  usersCollection,
  walletTransactionRef,
  walletTransactionsCollection,
  withdrawalsCollection
} from "../data/refs.js";
import { AppError } from "../utils/errors.js";
import { sortByNewest } from "../utils/time.js";

export class AdminService {
  constructor(
    private readonly db: Firestore,
    private readonly logger: Logger
  ) {}

  async getOverview(): Promise<AdminOverview> {
    const [userCountSnap, totalTaskCountSnap, activeTaskCountSnap, statsSnap] = await Promise.all([
      usersCollection(this.db).count().get(),
      tasksCollection(this.db).count().get(),
      tasksCollection(this.db).where("status", "==", "active").count().get(),
      platformStatsRef(this.db).get()
    ]);

    const stats = (statsSnap.exists ? statsSnap.data() : null) as PlatformStatsRecord | null;
    const totalTaskRewardsPaise = stats?.totalTaskRewardsPaise ?? 0;
    const totalReferralRewardsPaise = stats?.totalReferralRewardsPaise ?? 0;

    return {
      userCount: userCountSnap.data().count,
      totalTaskCount: totalTaskCountSnap.data().count,
      activeTaskCount: activeTaskCountSnap.data().count,
      pendingWithdrawalCount: stats?.pendingWithdrawalCount ?? 0,
      completedTaskCount: stats?.completedTaskCount ?? 0,
      totalTaskRewardsPaise,
      rewardedReferralCount: stats?.rewardedReferralCount ?? 0,
      totalReferralRewardsPaise,
      totalEarningsPaise: totalTaskRewardsPaise + totalReferralRewardsPaise,
      approvedWithdrawalCount: stats?.approvedWithdrawalCount ?? 0,
      totalWithdrawnPaise: stats?.totalWithdrawnPaise ?? 0
    };
  }

  async listUsers(): Promise<UserRecord[]> {
    const snapshot = await usersCollection(this.db).orderBy("createdAt", "desc").limit(200).get();
    return snapshot.docs.map((doc) => doc.data() as UserRecord);
  }

  async getUserDetail(userId: string): Promise<UserDetailResponse> {
    const userSnapshot = await userRef(this.db, userId).get();
    if (!userSnapshot.exists) {
      throw new AppError(404, "user_not_found", "User not found.");
    }

    const user = userSnapshot.data() as UserRecord;
    const [allReferralsSnapshot, walletTransactionsSnapshot, withdrawalsSnapshot] = await Promise.all([
      referralsCollection(this.db).get(),
      walletTransactionsCollection(this.db).where("userId", "==", userId).get(),
      withdrawalsCollection(this.db).where("userId", "==", userId).get()
    ]);

    const referralRecords = allReferralsSnapshot.docs
      .map((doc) => doc.data() as ReferralRecord)
      .filter((entry) => entry.referrerId === userId || entry.referredId === userId);

    const userIds = new Set<string>();
    referralRecords.forEach((entry) => {
      userIds.add(entry.referrerId);
      userIds.add(entry.referredId);
    });

    const relatedUsers = await Promise.all(
      Array.from(userIds).map(async (id) => {
        const snapshot = await userRef(this.db, id).get();
        return [id, snapshot.exists ? (snapshot.data() as UserRecord) : null] as const;
      })
    );

    const userMap = new Map(relatedUsers);
    const referrals: ReferralInsightRecord[] = referralRecords.map((entry) => ({
      ...entry,
      referrerDisplayName: userMap.get(entry.referrerId)?.displayName ?? entry.referrerId,
      referrerUsername: userMap.get(entry.referrerId)?.username ?? null,
      referredDisplayName: userMap.get(entry.referredId)?.displayName ?? entry.referredId,
      referredUsername: userMap.get(entry.referredId)?.username ?? null
    }));

    return {
      user,
      referrals: sortByNewest(referrals, "createdAt"),
      withdrawals: sortByNewest(
        withdrawalsSnapshot.docs.map((doc) => doc.data() as WithdrawalRecord),
        "requestedAt"
      ),
      walletTransactions: sortByNewest(
        walletTransactionsSnapshot.docs.map((doc) => doc.data() as WalletTransactionRecord),
        "createdAt"
      )
    };
  }

  async listTasks(): Promise<TaskRecord[]> {
    const snapshot = await tasksCollection(this.db).orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => doc.data() as TaskRecord);
  }

  async listCompletedTasks(): Promise<CompletedTaskInsightRecord[]> {
    const snapshot = await taskCompletionsCollection(this.db).orderBy("updatedAt", "desc").limit(300).get();
    const completions = snapshot.docs.map((doc) => doc.data() as TaskCompletionRecord);

    const userIds = Array.from(new Set(completions.map((record) => record.userId)));
    const taskIds = Array.from(new Set(completions.map((record) => record.taskId)));

    const [users, tasks] = await Promise.all([
      Promise.all(
        userIds.map(async (id) => {
          const snapshot = await userRef(this.db, id).get();
          return [id, snapshot.exists ? (snapshot.data() as UserRecord) : null] as const;
        })
      ),
      Promise.all(
        taskIds.map(async (id) => {
          const snapshot = await tasksCollection(this.db).doc(id).get();
          return [id, snapshot.exists ? (snapshot.data() as TaskRecord) : null] as const;
        })
      )
    ]);

    const userMap = new Map(users);
    const taskMap = new Map(tasks);

    return sortByNewest(
      completions.map((completion) => ({
        id: completion.id,
        status: completion.status,
        userId: completion.userId,
        userDisplayName: userMap.get(completion.userId)?.displayName ?? completion.userId,
        username: userMap.get(completion.userId)?.username ?? null,
        taskId: completion.taskId,
        taskTitle: taskMap.get(completion.taskId)?.title ?? completion.taskId,
        taskType: taskMap.get(completion.taskId)?.taskType ?? "site_wait",
        rewardPaise: completion.rewardPaise,
        proofImageUrl: completion.proofImageUrl,
        proofImageThumbUrl: completion.proofImageThumbUrl,
        completedAt: completion.completedAt ?? completion.updatedAt,
        startedAt: completion.startedAt
      })),
      "completedAt"
    );
  }

  async listWithdrawals(): Promise<WithdrawalRecord[]> {
    const snapshot = await withdrawalsCollection(this.db).orderBy("requestedAt", "desc").limit(200).get();
    return snapshot.docs.map((doc) => doc.data() as WithdrawalRecord);
  }

  async listReferralInsights(): Promise<ReferralInsightRecord[]> {
    const snapshot = await referralsCollection(this.db).orderBy("createdAt", "desc").limit(200).get();
    const referrals = snapshot.docs.map((doc) => doc.data() as ReferralRecord);
    const ids = new Set<string>();

    referrals.forEach((entry) => {
      ids.add(entry.referrerId);
      ids.add(entry.referredId);
    });

    const relatedUsers = await Promise.all(
      Array.from(ids).map(async (id) => {
        const snap = await userRef(this.db, id).get();
        return [id, snap.exists ? (snap.data() as UserRecord) : null] as const;
      })
    );

    const userMap = new Map(relatedUsers);
    return referrals.map((entry) => ({
      ...entry,
      referrerDisplayName: userMap.get(entry.referrerId)?.displayName ?? entry.referrerId,
      referrerUsername: userMap.get(entry.referrerId)?.username ?? null,
      referredDisplayName: userMap.get(entry.referredId)?.displayName ?? entry.referredId,
      referredUsername: userMap.get(entry.referredId)?.username ?? null
    }));
  }

  async adjustUserBalance(input: {
    userId: string;
    amountPaise: number;
    note: string;
    adminEmail: string;
  }) {
    return this.db.runTransaction(async (transaction) => {
      const timestamp = new Date().toISOString();
      const userSnapshot = await transaction.get(userRef(this.db, input.userId));
      if (!userSnapshot.exists) {
        throw new AppError(404, "user_not_found", "User not found.");
      }

      const user = userSnapshot.data() as UserRecord;
      if (user.pendingWithdrawalId) {
        throw new AppError(400, "withdrawal_pending", "Clear the pending withdrawal before changing this balance.");
      }

      const nextBalance = user.balancePaise + input.amountPaise;
      if (nextBalance < 0) {
        throw new AppError(400, "insufficient_balance", "Balance cannot go below zero.");
      }

      const txId = `admin_adjust_${input.userId}_${Date.now()}`;
      const noteSuffix = input.note.trim().slice(0, 160);

      transaction.set(
        userRef(this.db, input.userId),
        {
          balancePaise: nextBalance,
          updatedAt: timestamp,
          lastActiveAt: timestamp
        },
        { merge: true }
      );
      transaction.set(
        walletTransactionRef(this.db, txId),
        {
          id: txId,
          userId: input.userId,
          type: "admin_adjustment",
          amountPaise: input.amountPaise,
          balanceAfterPaise: nextBalance,
          referenceType: "admin",
          referenceId: `${input.adminEmail}: ${noteSuffix}`,
          createdAt: timestamp
        } satisfies WalletTransactionRecord
      );

      const updatedUser: UserRecord = {
        ...user,
        balancePaise: nextBalance,
        updatedAt: timestamp,
        lastActiveAt: timestamp
      };

      this.logger.info({ userId: input.userId, amountPaise: input.amountPaise, adminEmail: input.adminEmail }, "admin_balance_adjusted");
      return updatedUser;
    });
  }

  logAdminAction(action: string, payload: Record<string, unknown>) {
    this.logger.info({ action, ...payload }, "admin_action");
  }
}
