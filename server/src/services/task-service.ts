import { FieldValue, type Firestore, type QueryDocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type {
  CompletionStatus,
  TaskCompletionRecord,
  TaskImageRecord,
  TaskListItem,
  TaskRecord,
  TaskType,
  UserRecord,
  WalletTransactionRecord
} from "../../../shared/src/types.js";
import { RISK_FLAGS } from "../../../shared/src/constants.js";
import {
  platformStatsRef,
  referralRef,
  taskCompletionRef,
  taskCompletionsCollection,
  taskRef,
  tasksCollection,
  userRef,
  walletTransactionRef
} from "../data/refs.js";
import { AppError } from "../utils/errors.js";
import { addSecondsIso, nowIso, sortByNewest } from "../utils/time.js";

type TaskCompletionResult =
  | { status: "already_completed"; task: TaskRecord }
  | { status: "not_started"; task: TaskRecord }
  | { status: "timer_pending"; task: TaskRecord; secondsRemaining: number }
  | { status: "proof_required"; task: TaskRecord }
  | { status: "completed"; task: TaskRecord; newBalancePaise: number };

type SessionProgress = {
  status: "started" | "qualified";
  secondsRemaining: number;
  sessionUrl: string;
};

export type TaskSessionView = {
  token: string;
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  description: string;
  link: string;
  caption: string | null;
  galleryImages: TaskImageRecord[];
  timerSeconds: number;
  proofRequired: boolean;
  proofUploaded: boolean;
  timerStartedAt: string | null;
  timerQualifiedAt: string | null;
  status: CompletionStatus;
  canClaim: boolean;
  secondsRemaining: number;
  returnToBotUrl: string;
};

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
        completionStatus: (completionMap.get(task.id)?.status === "started" || completionMap.get(task.id)?.status === "proof_submitted"
          ? "started"
          : "not_started") as TaskListItem["completionStatus"],
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

  async getTaskProgress(userId: string, taskId: string) {
    const [taskSnapshot, completionSnapshot] = await Promise.all([
      taskRef(this.db, taskId).get(),
      taskCompletionRef(this.db, `${userId}_${taskId}`).get()
    ]);

    if (!taskSnapshot.exists) {
      throw new AppError(404, "task_not_found", "Task not found.");
    }

    return {
      task: taskSnapshot.data() as TaskRecord,
      completion: completionSnapshot.exists ? (completionSnapshot.data() as TaskCompletionRecord) : null,
      sessionUrl:
        completionSnapshot.exists && (completionSnapshot.data() as TaskCompletionRecord).sessionToken
          ? this.buildTaskSessionUrl((completionSnapshot.data() as TaskCompletionRecord).sessionToken as string)
          : null
    };
  }

  async createTask(input: {
    taskType: TaskType;
    title: string;
    description: string;
    link: string;
    caption?: string | null;
    galleryImages?: TaskImageRecord[];
    timerSeconds?: number;
    proofRequired?: boolean;
    rewardPaise?: number;
    status?: TaskRecord["status"];
  }) {
    const timestamp = nowIso();
    const id = `task_${nanoid(10)}`;
    const task: TaskRecord = {
      id,
      taskType: input.taskType,
      title: input.title,
      description: input.description,
      link: input.link,
      caption: input.caption ?? null,
      galleryImages: input.galleryImages ?? [],
      timerSeconds: input.timerSeconds ?? this.config.rewards.taskTimerSeconds,
      proofRequired: input.proofRequired ?? true,
      rewardPaise: input.rewardPaise ?? this.config.rewards.taskRewardPaise,
      status: input.status ?? "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.assertTaskConfiguration(task);
    await taskRef(this.db, id).set(task);
    this.logger.info({ taskId: id, taskType: task.taskType }, "task_created");
    return task;
  }

  async updateTask(
    taskId: string,
    updates: Partial<Pick<TaskRecord, "taskType" | "title" | "description" | "link" | "caption" | "galleryImages" | "timerSeconds" | "proofRequired" | "rewardPaise" | "status">>
  ) {
    const existing = await this.getTask(taskId);
    const nextTask: TaskRecord = {
      ...existing,
      ...updates,
      updatedAt: nowIso()
    };

    this.assertTaskConfiguration(nextTask);
    await taskRef(this.db, taskId).set(nextTask);
    this.logger.info({ taskId }, "task_updated");
    return nextTask;
  }

  async deleteTask(taskId: string) {
    await this.getTask(taskId);
    await taskRef(this.db, taskId).delete();
    this.logger.info({ taskId }, "task_deleted");
  }

  async startTask(userId: string, taskId: string): Promise<{ task: TaskRecord; sessionToken: string; sessionUrl: string }> {
    const startedAt = nowIso();
    const sessionToken = nanoid(24);

    const result = await this.db.runTransaction(async (transaction) => {
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
        if (!completion.sessionToken) {
          transaction.set(
            completionSnapshot.ref,
            {
              sessionToken,
              updatedAt: startedAt
            },
            { merge: true }
          );
        }

        return {
          task,
          sessionToken: completion.sessionToken ?? sessionToken
        };
      }

      const completion: TaskCompletionRecord = {
        id: `${userId}_${taskId}`,
        userId,
        taskId,
        status: "started",
        startedAt,
        completedAt: null,
        proofSubmittedAt: null,
        proofImageUrl: null,
        proofImageThumbUrl: null,
        proofImageDeleteUrl: null,
        timerStartedAt: null,
        timerQualifiedAt: null,
        sessionToken,
        rewardPaise: task.rewardPaise,
        createdAt: startedAt,
        updatedAt: startedAt
      };

      transaction.set(taskCompletionRef(this.db, completion.id), completion);
      return {
        task,
        sessionToken
      };
    });

    return {
      task: result.task,
      sessionToken: result.sessionToken,
      sessionUrl: this.buildTaskSessionUrl(result.sessionToken)
    };
  }

  async prepareProofSubmission(userId: string, taskId: string) {
    const progress = await this.getTaskProgress(userId, taskId);
    if (!progress.completion) {
      throw new AppError(400, "task_not_started", "Start the task first.");
    }

    if (progress.completion.status === "completed") {
      throw new AppError(400, "task_already_completed", "This task is already completed.");
    }

    return progress;
  }

  async recordTaskProof(userId: string, taskId: string, proof: TaskImageRecord) {
    const progress = await this.prepareProofSubmission(userId, taskId);
    const timestamp = nowIso();

    const completion: TaskCompletionRecord = {
      ...(progress.completion as TaskCompletionRecord),
      status: "proof_submitted",
      proofSubmittedAt: timestamp,
      proofImageUrl: proof.url,
      proofImageThumbUrl: proof.displayUrl,
      proofImageDeleteUrl: proof.deleteUrl,
      updatedAt: timestamp
    };

    await taskCompletionRef(this.db, completion.id).set(completion);
    return completion;
  }

  async startSessionTimer(sessionToken: string): Promise<SessionProgress> {
    const { task, completionSnapshot, completion } = await this.getCompletionBySessionToken(sessionToken);
    if (completion.status === "completed") {
      return {
        status: "qualified",
        secondsRemaining: 0,
        sessionUrl: this.buildTaskSessionUrl(sessionToken)
      };
    }

    if (task.taskType === "maps_review" && task.proofRequired && !completion.proofImageUrl) {
      throw new AppError(400, "proof_required", "Upload your screenshot proof in Telegram before starting this timer.");
    }

    const startedAt = completion.timerStartedAt ?? nowIso();
    if (!completion.timerStartedAt) {
      await completionSnapshot.ref.set(
        {
          timerStartedAt: startedAt,
          updatedAt: nowIso()
        },
        { merge: true }
      );
    }

    return {
      status: completion.timerQualifiedAt ? "qualified" : "started",
      secondsRemaining: this.getSecondsRemaining(startedAt, task.timerSeconds),
      sessionUrl: this.buildTaskSessionUrl(sessionToken)
    };
  }

  async finishSessionTimer(sessionToken: string): Promise<SessionProgress> {
    const { task, completionSnapshot, completion } = await this.getCompletionBySessionToken(sessionToken);
    if (!completion.timerStartedAt) {
      throw new AppError(400, "timer_not_started", "Start the timer first.");
    }

    const secondsRemaining = this.getSecondsRemaining(completion.timerStartedAt, task.timerSeconds);
    if (secondsRemaining > 0) {
      return {
        status: "started",
        secondsRemaining,
        sessionUrl: this.buildTaskSessionUrl(sessionToken)
      };
    }

    if (!completion.timerQualifiedAt) {
      await completionSnapshot.ref.set(
        {
          timerQualifiedAt: nowIso(),
          updatedAt: nowIso()
        },
        { merge: true }
      );
    }

    return {
      status: "qualified",
      secondsRemaining: 0,
      sessionUrl: this.buildTaskSessionUrl(sessionToken)
    };
  }

  async getSessionView(sessionToken: string): Promise<TaskSessionView> {
    const { task, completion } = await this.getCompletionBySessionToken(sessionToken);
    const secondsRemaining = completion.timerStartedAt ? this.getSecondsRemaining(completion.timerStartedAt, task.timerSeconds) : task.timerSeconds;

    return {
      token: sessionToken,
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.taskType,
      description: task.description,
      link: task.link,
      caption: task.caption,
      galleryImages: task.galleryImages,
      timerSeconds: task.timerSeconds,
      proofRequired: task.proofRequired,
      proofUploaded: Boolean(completion.proofImageUrl),
      timerStartedAt: completion.timerStartedAt,
      timerQualifiedAt: completion.timerQualifiedAt,
      status: completion.status,
      canClaim: this.canClaim(task, completion),
      secondsRemaining: completion.timerQualifiedAt ? 0 : secondsRemaining,
      returnToBotUrl: `https://t.me/${this.config.telegram.username}`
    };
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

      if (task.proofRequired && !completion.proofImageUrl) {
        return { status: "proof_required" as const, task };
      }

      if (!completion.timerQualifiedAt) {
        const secondsRemaining = completion.timerStartedAt
          ? this.getSecondsRemaining(completion.timerStartedAt, task.timerSeconds)
          : task.timerSeconds;
        this.addRiskFlag(transaction, user, RISK_FLAGS.cooldownBypassAttempt, timestamp);
        return { status: "timer_pending" as const, secondsRemaining, task };
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

  buildTaskSessionUrl(sessionToken: string) {
    return `${this.config.telegram.webhookBaseUrl}/task-session/${sessionToken}`;
  }

  private async getCompletionBySessionToken(sessionToken: string) {
    const snapshot = await taskCompletionsCollection(this.db).where("sessionToken", "==", sessionToken).limit(1).get();
    const completionSnapshot = snapshot.docs[0] as QueryDocumentSnapshot | undefined;
    if (!completionSnapshot) {
      throw new AppError(404, "session_not_found", "Task session not found.");
    }

    const completion = completionSnapshot.data() as TaskCompletionRecord;
    const task = await this.getTask(completion.taskId);
    return {
      completionSnapshot,
      completion,
      task
    };
  }

  private canClaim(task: TaskRecord, completion: TaskCompletionRecord) {
    const proofReady = !task.proofRequired || Boolean(completion.proofImageUrl);
    const timerReady = task.timerSeconds <= 0 || Boolean(completion.timerQualifiedAt);
    return proofReady && timerReady && completion.status !== "completed";
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

  private getSecondsRemaining(startedAt: string, timerSeconds: number): number {
    const endsAt = addSecondsIso(startedAt, timerSeconds);
    const remainingMs = Date.parse(endsAt) - Date.now();
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }

  private assertTaskConfiguration(task: TaskRecord) {
    if (task.taskType === "maps_review") {
      if (!task.caption?.trim()) {
        throw new AppError(400, "invalid_task", "Maps review tasks require a caption or review text.");
      }

      if (!task.galleryImages.length) {
        throw new AppError(400, "invalid_task", "Maps review tasks require at least one reference image.");
      }
    }
  }
}
