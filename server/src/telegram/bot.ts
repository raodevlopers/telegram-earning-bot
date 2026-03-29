import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import { isValidPayoutDestination, parseReferralPayload } from "../../../shared/src/validators.js";
import type { PayoutType, TelegramProfile, UserRecord } from "../../../shared/src/types.js";
import type { AppServices } from "../types/app-services.js";
import { CALLBACKS } from "../constants/callbacks.js";
import {
  backKeyboard,
  dashboardMessage,
  mainMenuKeyboard,
  referralMessage,
  taskDetailKeyboard,
  taskDetailMessage,
  taskListKeyboard,
  taskListMessage,
  taskOpenedMessage,
  taskOpenKeyboard,
  walletMessage,
  withdrawalCreatedMessage,
  withdrawalCancelKeyboard,
  withdrawalInputMessage,
  withdrawalPromptMessage,
  withdrawalTypeKeyboard
} from "./messages.js";
import { AppError } from "../utils/errors.js";

type BotServices = Omit<AppServices, "bot">;
type BotContext = Context & { match?: RegExpExecArray; message?: { text?: string } };

export function createBot(services: BotServices) {
  const { config, logger, taskService, userService, withdrawalService } = services;
  const bot = new Telegraf(config.telegram.token);

  bot.catch((error, ctx) => {
    logger.error({ err: error, updateId: ctx.update.update_id }, "telegram_handler_failed");
  });

  bot.start(async (ctx) => {
    const profile = toTelegramProfile(ctx.from);
    const payload = extractStartPayload(ctx.message?.text ?? "");
    const referredBy = parseReferralPayload(payload);

    await userService.registerOrGetTelegramUser(profile, referredBy);
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

    const tasks = await taskService.listAvailableTasksForUser(user.id);
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      throw new AppError(404, "task_not_found", "Task not found or already completed.");
    }

    await sendOrReplace(ctx as BotContext, taskDetailMessage(task, task.completionStatus), taskDetailKeyboard(taskId));
  });

  bot.action(/^task:open:(.+)$/i, async (ctx) => {
    await ctx.answerCbQuery("Task opened.");
    const user = await ensureUser(ctx.from, services);
    const taskId = (ctx as BotContext).match?.[1];
    if (!taskId) {
      throw new AppError(400, "task_not_found", "Task not found.");
    }

    const task = await taskService.startTask(user.id, taskId);
    await sendOrReplace(ctx as BotContext, taskOpenedMessage(task, config.rewards.taskVerifyCooldownSeconds), taskOpenKeyboard(task));
  });

  bot.action(/^task:verify:(.+)$/i, async (ctx) => {
    const user = await ensureUser(ctx.from, services);
    const taskId = (ctx as BotContext).match?.[1];
    if (!taskId) {
      throw new AppError(400, "task_not_found", "Task not found.");
    }

    const result = await taskService.completeTask(user.id, taskId);
    if (result.status === "cooldown") {
      await ctx.answerCbQuery(`Wait ${result.secondsRemaining}s before verifying again.`, { show_alert: true });
      return;
    }

    if (result.status === "not_started") {
      await ctx.answerCbQuery("Open the task first.", { show_alert: true });
      return;
    }

    if (result.status === "already_completed") {
      await ctx.answerCbQuery("This task has already been credited.", { show_alert: true });
      await showDashboard(ctx as BotContext, services, user.id);
      return;
    }

    await ctx.answerCbQuery("Reward added to your wallet.");
    await showDashboard(ctx as BotContext, services, user.id);
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
        `Your balance is below the minimum withdrawal amount of ${config.rewards.minWithdrawalPaise / 100}. Keep completing tasks first.`,
        backKeyboard()
      );
      return;
    }

    await sendOrReplace(ctx as BotContext, withdrawalPromptMessage(user, config), withdrawalTypeKeyboard());
  });

  bot.action(/^withdraw:type:(UPI|PAYTM)$/i, async (ctx) => {
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
    await ctx.answerCbQuery("Withdrawal cancelled.");
    const user = await ensureUser(ctx.from, services);
    await userService.setBotState(user.id, null);
    await showDashboard(ctx as BotContext, services, user.id);
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message?.text ?? "";
    if (text.startsWith("/")) {
      return;
    }

    const user = await ensureUser(ctx.from, services);
    if (!user.botState || user.botState.flow !== "awaiting_withdrawal_destination") {
      return;
    }

    const destination = text.trim();
    if (!isValidPayoutDestination(user.botState.payoutType, destination)) {
      await ctx.reply("That payout destination format is invalid. Please send a valid UPI ID or 10-digit Paytm number.", {
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

async function sendOrReplace(ctx: BotContext, text: string, keyboard: ReturnType<typeof mainMenuKeyboard>) {
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
