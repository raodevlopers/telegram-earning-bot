import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { TaskCompletionRecord, TaskListItem, TaskRecord, UserRecord, WalletTransactionRecord } from "../../../shared/src/types.js";
import { RISK_FLAGS } from "../../../shared/src/constants.js";
import { platformStatsRef, referralRef, taskCompletionRef, taskCompletionsCollection, taskRef, tasksCollection, userRef, walletTransactionRef } from "../data/refs.js";
import { AppError } from "../utils/errors.js";
import { nowIso, sortByNewest } from "../utils/time.js";

type TaskCompletionResult =
  | { status: "already_completed"; task: TaskRecord }
  | { status: "cooldown"; secondsRemaining: number; task: TaskRecord }
  | { status: "not_started"; task: TaskRecord }
  | { status: "completed"; task: TaskRecord; newBalancePaise: number };

export class TaskService {
  constructor(
    private readonly db: Firestore,
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {}

  async listAvailableTasksForUser(userId: string): Promise<TaskListItem[]> {
    const [tasksSnapshot, completionsSnapshot] = await Promise.all([
      tasksCollection(this.db).where("status", "==", "active").get(),
      taskCompletionsCollection(this.db).where("userId", "==", userId).get()
    ]);

    const completionMap = new Map(
      completionsSnapshot.docs.map((doc) => {
        const data = doc.data() as TaskCompletionRecord;
        return [data.taskId, data] as const;
      })
    );

    const visibleTasks = tasksSnapshot.docs
      .map((doc) => doc.data() as TaskRecord)
      .filter((task) => completionMap.get(task.id)?.status !== "completed")
      .map((task) => ({
        ...task,
        completionStatus: (completionMap.get(task.id)?.status === "started" ? "started" : "not_started") as TaskListItem["completionStatus"],
        startedAt: completionMap.get(task.id)?.startedAt ?? null
      }));

    return sortByNewest(visibleTasks, "createdAt");
  }

  async getTask(taskId: string): Promise<TaskRecord> {
    const snapshot = await taskRef(this.db, taskId).get();
    if (!snapshot.exists) {
      throw new AppError(404, "task_not_found", "Task not found.");
    }

    return snapshot.data() as TaskRecord;
  }

  async createTask(input: { title: string; description: string; link: string; rewardPaise?: number; status?: TaskRecord["status"] }) {
    const timestamp = nowIso();
    const id = `task_${nanoid(10)}`;
    const task: TaskRecord = {
      id,
      title: input.title,
      description: input.description,
      link: input.link,
      rewardPaise: input.rewardPaise ?? this.config.rewards.taskRewardPaise,
      status: input.status ?? "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await taskRef(this.db, id).set(task);
    this.logger.info({ taskId: id }, "task_created");
    return task;
  }

  async updateTask(taskId: string, updates: Partial<Pick<TaskRecord, "title" | "description" | "link" | "rewardPaise" | "status">>) {
    const existing = await this.getTask(taskId);
    const nextTask: TaskRecord = {
      ...existing,
      ...updates,
      updatedAt: nowIso()
    };

    await taskRef(this.db, taskId).set(nextTask);
    this.logger.info({ taskId }, "task_updated");
    return nextTask;
  }

  async deleteTask(taskId: string) {
    await this.getTask(taskId);
    await taskRef(this.db, taskId).delete();
    this.logger.info({ taskId }, "task_deleted");
  }

  async startTask(userId: string, taskId: string): Promise<TaskRecord> {
    const startedAt = nowIso();

    await this.db.runTransaction(async (transaction) => {
      const [taskSnapshot, completionSnapshot] = await Promise.all([
        transaction.get(taskRef(this.db, taskId)),
        transaction.get(taskCompletionRef(this.db, `${userId}_${taskId}`))
      ]);

      if (!taskSnapshot.exists) {
        throw new AppError(404, "task_not_found", "Task not found.");
      }

      const task = taskSnapshot.data() as TaskRecord;
      if (task.status !== "active") {
        throw new AppError(400, "task_inactive", "This task is not available right now.");
      }

      if (completionSnapshot.exists) {
        const completion = completionSnapshot.data() as TaskCompletionRecord;
        if (completion.status === "completed") {
          return;
        }

        return;
      }

      const completion: TaskCompletionRecord = {
        id: `${userId}_${taskId}`,
        userId,
        taskId,
        status: "started",
        startedAt,
        completedAt: null,
        rewardPaise: task.rewardPaise,
        createdAt: startedAt,
        updatedAt: startedAt
      };

      transaction.set(taskCompletionRef(this.db, completion.id), completion);
    });

    return this.getTask(taskId);
  }

  async completeTask(userId: string, taskId: string): Promise<TaskCompletionResult> {
    const completionResult = await this.db.runTransaction(async (transaction) => {
      const timestamp = nowIso();
      const [userSnapshot, taskSnapshot, completionSnapshot] = await Promise.all([
        transaction.get(userRef(this.db, userId)),
        transaction.get(taskRef(this.db, taskId)),
        transaction.get(taskCompletionRef(this.db, `${userId}_${taskId}`))
      ]);

      if (!userSnapshot.exists) {
        throw new AppError(404, "user_not_found", "User not found.");
      }

      if (!taskSnapshot.exists) {
        throw new AppError(404, "task_not_found", "Task not found.");
      }

      const user = userSnapshot.data() as UserRecord;
      const task = taskSnapshot.data() as TaskRecord;

      if (task.status !== "active") {
        throw new AppError(400, "task_inactive", "This task is not available right now.");
      }

      if (!completionSnapshot.exists) {
        return { status: "not_started" as const, task };
      }

      const completion = completionSnapshot.data() as TaskCompletionRecord;
      if (completion.status === "completed") {
        return { status: "already_completed" as const, task };
      }

      const secondsRemaining = this.getSecondsRemaining(completion.startedAt);
      if (secondsRemaining > 0) {
        this.addRiskFlag(transaction, user, RISK_FLAGS.cooldownBypassAttempt, timestamp);
        return { status: "cooldown" as const, secondsRemaining, task };
      }

      const taskWalletRef = walletTransactionRef(this.db, `task_${userId}_${taskId}`);
      const walletSnapshot = await transaction.get(taskWalletRef);
      if (walletSnapshot.exists) {
        return { status: "already_completed" as const, task };
      }

      const nextBalance = user.balancePaise + task.rewardPaise;
      const nextUser: Partial<UserRecord> = {
        balancePaise: nextBalance,
        completedTaskCount: user.completedTaskCount + 1,
        taskEarningsPaise: user.taskEarningsPaise + task.rewardPaise,
        updatedAt: timestamp,
        lastActiveAt: timestamp
      };

      if (!user.firstTaskCompletedAt) {
        nextUser.firstTaskCompletedAt = timestamp;
      }

      const nextCompletion: TaskCompletionRecord = {
        ...completion,
        status: "completed",
        completedAt: timestamp,
        updatedAt: timestamp,
        rewardPaise: task.rewardPaise
      };

      transaction.set(taskCompletionRef(this.db, nextCompletion.id), nextCompletion);
      transaction.set(userRef(this.db, userId), nextUser, { merge: true });
      transaction.set(
        taskWalletRef,
        this.createWalletRecord({
          id: `task_${userId}_${taskId}`,
          userId,
          amountPaise: task.rewardPaise,
          balanceAfterPaise: nextBalance,
          referenceType: "task",
          referenceId: taskId,
          type: "task_reward",
          createdAt: timestamp
        })
      );
      transaction.set(
        platformStatsRef(this.db),
        {
          id: "platform",
          completedTaskCount: FieldValue.increment(1),
          totalTaskRewardsPaise: FieldValue.increment(task.rewardPaise),
          updatedAt: timestamp
        },
        { merge: true }
      );

      if (!user.firstTaskCompletedAt && user.referredBy && user.referredBy !== user.id) {
        await this.rewardReferrer(transaction, user, timestamp);
      }

      return {
        status: "completed" as const,
        task,
        newBalancePaise: nextBalance
      };
    });

    return completionResult;
  }

  private async rewardReferrer(transaction: Transaction, user: UserRecord, timestamp: string) {
    const referredBy = user.referredBy;
    if (!referredBy) {
      return;
    }

    const [referrerSnapshot, referralSnapshot, referralWalletSnapshot] = await Promise.all([
      transaction.get(userRef(this.db, referredBy)),
      transaction.get(referralRef(this.db, `${referredBy}_${user.id}`)),
      transaction.get(walletTransactionRef(this.db, `referral_${referredBy}_${user.id}`))
    ]);

    if (!referrerSnapshot.exists || referralWalletSnapshot.exists) {
      return;
    }

    const referrer = referrerSnapshot.data() as UserRecord;
    const rewardAlreadyGranted = referralSnapshot.exists ? Boolean(referralSnapshot.data()?.rewardGranted) : false;
    if (rewardAlreadyGranted) {
      return;
    }

    const reward = this.config.rewards.referralRewardPaise;
    const nextBalance = referrer.balancePaise + reward;

    transaction.set(
      referralRef(this.db, `${referredBy}_${user.id}`),
      {
        id: `${referredBy}_${user.id}`,
        referrerId: referredBy,
        referredId: user.id,
        rewardGranted: true,
        rewardedAt: timestamp,
        createdAt: referralSnapshot.exists ? referralSnapshot.data()?.createdAt ?? timestamp : timestamp,
        updatedAt: timestamp
      },
      { merge: true }
    );

    transaction.set(
      userRef(this.db, referredBy),
      {
        balancePaise: nextBalance,
        referralCount: referrer.referralCount + 1,
        referralEarningsPaise: referrer.referralEarningsPaise + reward,
        updatedAt: timestamp,
        lastActiveAt: timestamp
      },
      { merge: true }
    );

    transaction.set(
      walletTransactionRef(this.db, `referral_${referredBy}_${user.id}`),
      this.createWalletRecord({
        id: `referral_${referredBy}_${user.id}`,
        userId: referredBy,
        amountPaise: reward,
        balanceAfterPaise: nextBalance,
        referenceType: "referral",
        referenceId: user.id,
        type: "referral_reward",
        createdAt: timestamp
      })
    );

    transaction.set(
      platformStatsRef(this.db),
      {
        id: "platform",
        rewardedReferralCount: FieldValue.increment(1),
        totalReferralRewardsPaise: FieldValue.increment(reward),
        updatedAt: timestamp
      },
      { merge: true }
    );
  }

  private addRiskFlag(transaction: Transaction, user: UserRecord, flag: string, timestamp: string) {
    if (user.riskFlags.includes(flag)) {
      return;
    }

    transaction.set(
      userRef(this.db, user.id),
      {
        riskFlags: [...user.riskFlags, flag],
        updatedAt: timestamp
      },
      { merge: true }
    );
  }

  private createWalletRecord(record: WalletTransactionRecord) {
    return record;
  }

  private getSecondsRemaining(startedAt: string): number {
    const elapsedSeconds = Math.floor((Date.now() - Date.parse(startedAt)) / 1000);
    return Math.max(0, this.config.rewards.taskVerifyCooldownSeconds - elapsedSeconds);
  }
}
