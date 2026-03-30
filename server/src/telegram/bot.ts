import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import { isValidPayoutDestination, parseReferralPayload } from "../../../shared/src/validators.js";
import type { PayoutType, TelegramProfile, TaskRecord, UserRecord } from "../../../shared/src/types.js";
import type { AppServices } from "../types/app-services.js";
import { CALLBACKS } from "../constants/callbacks.js";
import {
  backKeyboard,
  dashboardMessage,
  mainMenuKeyboard,
  referralMessage,
  taskCompletedMessage,
  taskDetailKeyboard,
  taskDetailMessage,
  taskListKeyboard,
  taskListMessage,
  taskProofPromptMessage,
  taskProofReceivedMessage,
  taskProofRequiredMessage,
  taskStartedKeyboard,
  taskStartedMessage,
  taskTimerPendingMessage,
  walletMessage,
  withdrawalCancelKeyboard,
  withdrawalCreatedMessage,
  withdrawalInputMessage,
  withdrawalPromptMessage,
  withdrawalTypeKeyboard
} from "./messages.js";
import { AppError } from "../utils/errors.js";
import { escapeHtml } from "../utils/telegram.js";
import { getTimeBasedGreeting } from "../utils/time.js";

type BotServices = Omit<AppServices, "bot" | "reminderService">;
type BotContext = Context & {
  match?: RegExpExecArray;
  message?: {
    text?: string;
    photo?: Array<{ file_id: string }>;
    document?: { file_id: string; file_name?: string; mime_type?: string };
  };
};

export function createBot(services: BotServices) {
  const { config, logger, taskService, userService, withdrawalService, imageHostingService } = services;
  const bot = new Telegraf(config.telegram.token);

  bot.catch((error, ctx) => {
    logger.error({ err: error, updateId: ctx.update.update_id }, "telegram_handler_failed");
  });

  bot.start(async (ctx) => {
    const profile = toTelegramProfile(ctx.from);
    const payload = extractStartPayload(ctx.message?.text ?? "");
    const referredBy = parseReferralPayload(payload);

    const user = await userService.registerOrGetTelegramUser(profile, referredBy);
    await ctx.reply(buildGreetingMessage(user), { parse_mode: "HTML" });

    try {
      await ctx.replyWithDice();
    } catch {
      logger.debug({ userId: user.id }, "welcome_dice_failed");
    }

    await showDashboard(ctx as BotContext, services, profile.id);
  });

  bot.command("tasks", async (ctx) => {
    const user = await ensureUser(ctx.from, services);
    await showTasks(ctx as BotContext, services, user.id);
  });

  bot.command("wallet", async (ctx) => {
    const user = await ensureUser(ctx.from, services);
    await sendOrReplace(ctx as BotContext, walletMessage(user, config), backKeyboard());
  });

  bot.command("referral", async (ctx) => {
    const user = await ensureUser(ctx.from, services);
    const summary = await userService.getReferralSummary(user.id);
    await sendOrReplace(ctx as BotContext, referralMessage(user, summary.rewardedReferrals, summary.pendingReferrals, config), backKeyboard());
  });

  bot.action(CALLBACKS.dashboardRefresh, async (ctx) => {
    await ctx.answerCbQuery("Dashboard updated.");
    const user = await ensureUser(ctx.from, services);
    await showDashboard(ctx as BotContext, services, user.id);
  });

  bot.action(CALLBACKS.home, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUser(ctx.from, services);
    await showDashboard(ctx as BotContext, services, user.id);
  });

  bot.action(CALLBACKS.tasksList, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUser(ctx.from, services);
    await showTasks(ctx as BotContext, services, user.id);
  });

  bot.action(/^task:view:(.+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUser(ctx.from, services);
    const taskId = (ctx as BotContext).match?.[1];
    if (!taskId) {
      throw new AppError(400, "task_not_found", "Task not found.");
    }

    const progress = await taskService.getTaskProgress(user.id, taskId);
    await sendOrReplace(ctx as BotContext, taskDetailMessage(progress.task, progress.completion), taskDetailKeyboard(taskId, progress.sessionUrl));
    await sendTaskGallery(ctx as BotContext, progress.task);
  });

  bot.action(/^task:start:(.+)$/i, async (ctx) => {
    await ctx.answerCbQuery("Task started.");
    const user = await ensureUser(ctx.from, services);
    const taskId = (ctx as BotContext).match?.[1];
    if (!taskId) {
      throw new AppError(400, "task_not_found", "Task not found.");
    }

    const launch = await taskService.startTask(user.id, taskId);
    await sendOrReplace(ctx as BotContext, taskStartedMessage(launch.task), taskStartedKeyboard(taskId, launch.sessionUrl));
    await sendTaskGallery(ctx as BotContext, launch.task);
  });

  bot.action(/^task:proof:(.+)$/i, async (ctx) => {
    const user = await ensureUser(ctx.from, services);
    const taskId = (ctx as BotContext).match?.[1];
    if (!taskId) {
      throw new AppError(400, "task_not_found", "Task not found.");
    }

    let progress;
    try {
      progress = await taskService.prepareProofSubmission(user.id, taskId);
    } catch (error) {
      if (error instanceof AppError && error.code === "task_not_started") {
        await ctx.answerCbQuery("Task pehle start karo.", { show_alert: true });
        return;
      }

      throw error;
    }

    await ctx.answerCbQuery("Send your screenshot now.");
    await userService.setBotState(user.id, {
      flow: "awaiting_task_proof",
      taskId: progress.task.id,
      taskTitle: progress.task.title,
      startedAt: new Date().toISOString()
    });

    await sendOrReplace(ctx as BotContext, taskProofPromptMessage(progress.task), taskDetailKeyboard(taskId, progress.sessionUrl));
  });

  bot.action(/^task:claim:(.+)$/i, async (ctx) => {
    const user = await ensureUser(ctx.from, services);
    const taskId = (ctx as BotContext).match?.[1];
    if (!taskId) {
      throw new AppError(400, "task_not_found", "Task not found.");
    }

    const result = await taskService.completeTask(user.id, taskId);
    if (result.status === "timer_pending") {
      await ctx.answerCbQuery("Timer abhi complete nahin hua.", { show_alert: true });
      await sendOrReplace(ctx as BotContext, taskTimerPendingMessage(result.secondsRemaining), backKeyboard());
      return;
    }

    if (result.status === "not_started") {
      await ctx.answerCbQuery("Task pehle start karo.", { show_alert: true });
      return;
    }

    if (result.status === "proof_required") {
      await ctx.answerCbQuery("Screenshot proof missing hai.", { show_alert: true });
      await sendOrReplace(ctx as BotContext, taskProofRequiredMessage(), backKeyboard());
      return;
    }

    if (result.status === "already_completed") {
      await ctx.answerCbQuery("Reward already added.", { show_alert: true });
      await showDashboard(ctx as BotContext, services, user.id);
      return;
    }

    await userService.setBotState(user.id, null);
    const tasks = await taskService.listAvailableTasksForUser(user.id);
    await ctx.answerCbQuery("Reward added to your wallet.");
    await sendOrReplace(ctx as BotContext, taskCompletedMessage(result.task, result.newBalancePaise, tasks.length), mainMenuKeyboard());

    try {
      await ctx.replyWithDice();
    } catch {
      logger.debug({ userId: user.id, taskId }, "completion_dice_failed");
    }
  });

  bot.action(CALLBACKS.referralView, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUser(ctx.from, services);
    const summary = await userService.getReferralSummary(user.id);
    await sendOrReplace(ctx as BotContext, referralMessage(user, summary.rewardedReferrals, summary.pendingReferrals, config), backKeyboard());
  });

  bot.action(CALLBACKS.walletView, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUser(ctx.from, services);
    await sendOrReplace(ctx as BotContext, walletMessage(user, config), backKeyboard());
  });

  bot.action(CALLBACKS.withdrawStart, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUser(ctx.from, services);
    if (user.pendingWithdrawalId) {
      await sendOrReplace(ctx as BotContext, "You already have a pending withdrawal request under review.", backKeyboard());
      return;
    }

    if (user.balancePaise < config.rewards.minWithdrawalPaise) {
      await sendOrReplace(
        ctx as BotContext,
        `Balance abhi ${config.rewards.minWithdrawalPaise / 100} se kam hai. Ek aur task ya referral complete karke withdrawal unlock karo.`,
        backKeyboard()
      );
      return;
    }

    await sendOrReplace(ctx as BotContext, withdrawalPromptMessage(user, config), withdrawalTypeKeyboard());
  });

  bot.action(/^withdraw:type:(UPI|PAYPAL|GOOGLE_PLAY)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await ensureUser(ctx.from, services);
    const payoutType = (ctx as BotContext).match?.[1] as PayoutType | undefined;
    if (!payoutType) {
      throw new AppError(400, "invalid_payout_type", "Invalid withdrawal type.");
    }

    await userService.setBotState(user.id, {
      flow: "awaiting_withdrawal_destination",
      payoutType,
      startedAt: new Date().toISOString()
    });

    await sendOrReplace(ctx as BotContext, withdrawalInputMessage(payoutType), withdrawalCancelKeyboard());
  });

  bot.action(CALLBACKS.withdrawCancel, async (ctx) => {
    await ctx.answerCbQuery("Cancelled.");
    const user = await ensureUser(ctx.from, services);
    await userService.setBotState(user.id, null);
    await showDashboard(ctx as BotContext, services, user.id);
  });

  bot.on("photo", async (ctx) => {
    const user = await ensureUser(ctx.from, services);
    if (!user.botState || user.botState.flow !== "awaiting_task_proof") {
      return;
    }

    const photo = ctx.message?.photo?.[ctx.message.photo.length - 1];
    if (!photo) {
      return;
    }

    const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
    const proof = await imageHostingService.uploadImageUrl(String(fileUrl), `${user.id}_${user.botState.taskId}_proof`);
    const completion = await taskService.recordTaskProof(user.id, user.botState.taskId, proof);
    const progress = await taskService.getTaskProgress(user.id, user.botState.taskId);
    await userService.setBotState(user.id, null);

    await ctx.reply(taskProofReceivedMessage(progress.task, progress.sessionUrl), {
      parse_mode: "HTML",
      reply_markup: taskDetailKeyboard(progress.task.id, progress.sessionUrl).reply_markup
    });

    logger.info({ userId: user.id, taskId: completion.taskId }, "task_proof_received");
  });

  bot.on("document", async (ctx) => {
    const user = await ensureUser(ctx.from, services);
    if (!user.botState || user.botState.flow !== "awaiting_task_proof") {
      return;
    }

    const document = ctx.message?.document;
    if (!document?.mime_type?.startsWith("image/")) {
      await ctx.reply("Please send the screenshot as an image.", { parse_mode: "HTML" });
      return;
    }

    const fileUrl = await ctx.telegram.getFileLink(document.file_id);
    const proof = await imageHostingService.uploadImageUrl(String(fileUrl), document.file_name ?? `${user.id}_${user.botState.taskId}_proof`);
    await taskService.recordTaskProof(user.id, user.botState.taskId, proof);
    const progress = await taskService.getTaskProgress(user.id, user.botState.taskId);
    await userService.setBotState(user.id, null);

    await ctx.reply(taskProofReceivedMessage(progress.task, progress.sessionUrl), {
      parse_mode: "HTML",
      reply_markup: taskDetailKeyboard(progress.task.id, progress.sessionUrl).reply_markup
    });
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message?.text ?? "";
    if (text.startsWith("/")) {
      return;
    }

    const user = await ensureUser(ctx.from, services);
    if (!user.botState) {
      return;
    }

    if (user.botState.flow === "awaiting_task_proof") {
      await ctx.reply("Screenshot proof photo ke form me bhejo please 📸", {
        parse_mode: "HTML",
        reply_markup: backKeyboard().reply_markup
      });
      return;
    }

    if (user.botState.flow !== "awaiting_withdrawal_destination") {
      return;
    }

    const destination = text.trim();
    if (!isValidPayoutDestination(user.botState.payoutType, destination)) {
      await ctx.reply("Destination format valid nahin hai. Sahi UPI ID, PayPal email, ya Google Play delivery detail bhejo.", {
        parse_mode: "HTML",
        reply_markup: withdrawalCancelKeyboard().reply_markup
      });
      return;
    }

    const withdrawal = await withdrawalService.createWithdrawalRequest(user.id, user.botState.payoutType, destination);
    await ctx.reply(withdrawalCreatedMessage(withdrawal), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard().reply_markup
    });
  });

  return bot;
}

export async function initializeBot(services: AppServices) {
  const webhookUrl = `${services.config.telegram.webhookBaseUrl}/telegram/webhook`;

  await services.bot.telegram.setMyCommands([
    { command: "start", description: "Open your earning dashboard" },
    { command: "tasks", description: "View available tasks" },
    { command: "wallet", description: "Check your wallet" },
    { command: "referral", description: "Get your referral link" }
  ]);
  await services.bot.telegram.setWebhook(webhookUrl, {
    secret_token: services.config.telegram.webhookSecret
  });

  services.logger.info({ webhookUrl }, "telegram_webhook_ready");
}

async function showDashboard(ctx: BotContext, services: BotServices, userId: string) {
  const [user, tasks, referralSummary] = await Promise.all([
    services.userService.getUser(userId),
    services.taskService.listAvailableTasksForUser(userId),
    services.userService.getReferralSummary(userId)
  ]);

  await sendOrReplace(
    ctx,
    dashboardMessage(user, tasks.length, referralSummary.rewardedReferrals, services.config),
    mainMenuKeyboard()
  );
}

async function showTasks(ctx: BotContext, services: BotServices, userId: string) {
  const tasks = await services.taskService.listAvailableTasksForUser(userId);
  const keyboard = tasks.length ? taskListKeyboard(tasks) : backKeyboard();
  await sendOrReplace(ctx, taskListMessage(tasks), keyboard);
}

async function ensureUser(from: BotContext["from"], services: BotServices): Promise<UserRecord> {
  if (!from) {
    throw new AppError(400, "telegram_user_missing", "Telegram user is missing from the update.");
  }

  const profile = toTelegramProfile(from);
  await services.userService.registerOrGetTelegramUser(profile, null);
  return services.userService.getUser(profile.id);
}

function buildGreetingMessage(user: UserRecord) {
  return [
    `<b>${escapeHtml(getTimeBasedGreeting())}, ${escapeHtml(user.firstName?.trim() || user.displayName)} ✨</b>`,
    "",
    "Welcome back to <b>Income Hub</b>.",
    "Task complete karo, screenshot proof bhejo, referral se extra earn karo aur apni first withdrawal unlock karo."
  ].join("\n");
}

function toTelegramProfile(from: NonNullable<BotContext["from"]>): TelegramProfile {
  return {
    id: String(from.id),
    username: from.username ?? null,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null
  };
}

function extractStartPayload(text: string) {
  const [, payload] = text.split(" ");
  return payload ?? null;
}

async function sendTaskGallery(ctx: BotContext, task: TaskRecord) {
  if (!task.galleryImages.length) {
    return;
  }

  try {
    await ctx.replyWithMediaGroup(
      task.galleryImages.slice(0, 3).map((image, index) => ({
        type: "photo" as const,
        media: image.url,
        caption: index === 0 ? `${task.title} reference images` : undefined
      }))
    );
  } catch {
    return;
  }
}

async function sendOrReplace(ctx: BotContext, text: string, keyboard: { reply_markup: any }) {
  const options = {
    parse_mode: "HTML" as const,
    reply_markup: keyboard.reply_markup
  };

  if ("callback_query" in ctx.update) {
    try {
      await ctx.editMessageText(text, options);
      return;
    } catch {
      await ctx.reply(text, options);
      return;
    }
  }

  await ctx.reply(text, options);
}
