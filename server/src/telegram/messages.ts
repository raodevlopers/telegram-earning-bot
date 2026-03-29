import { Markup } from "telegraf";
import { buildReferralLink, formatRelativeSeconds, formatRupeesFromPaise } from "../../../shared/src/format.js";
import type { AppConfig } from "../config/env.js";
import { CALLBACKS, taskOpenCallback, taskVerifyCallback, taskViewCallback, withdrawTypeCallback } from "../constants/callbacks.js";
import type { TaskListItem, TaskRecord, UserRecord, WithdrawalRecord } from "../../../shared/src/types.js";
import { escapeHtml } from "../utils/telegram.js";

export function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Refresh", CALLBACKS.dashboardRefresh),
      Markup.button.callback("Tasks", CALLBACKS.tasksList)
    ],
    [
      Markup.button.callback("Referral", CALLBACKS.referralView),
      Markup.button.callback("Wallet", CALLBACKS.walletView)
    ],
    [Markup.button.callback("Withdraw", CALLBACKS.withdrawStart)]
  ]);
}

export function backKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("Back to dashboard", CALLBACKS.home)]]);
}

export function taskListKeyboard(tasks: TaskListItem[]) {
  const rows = tasks.map((task) => [Markup.button.callback(task.title, taskViewCallback(task.id))]);
  rows.push([Markup.button.callback("Back to dashboard", CALLBACKS.home)]);
  return Markup.inlineKeyboard(rows);
}

export function taskDetailKeyboard(taskId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Open task", taskOpenCallback(taskId))],
    [Markup.button.callback("Verify completion", taskVerifyCallback(taskId))],
    [Markup.button.callback("Back to tasks", CALLBACKS.tasksList)]
  ]);
}

export function taskOpenKeyboard(task: TaskRecord) {
  return Markup.inlineKeyboard([
    [Markup.button.url("Visit task link", task.link)],
    [Markup.button.callback("Verify completion", taskVerifyCallback(task.id))],
    [Markup.button.callback("Back to tasks", CALLBACKS.tasksList)]
  ]);
}

export function withdrawalTypeKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("UPI", withdrawTypeCallback("UPI")),
      Markup.button.callback("Paytm", withdrawTypeCallback("PAYTM"))
    ],
    [Markup.button.callback("Cancel", CALLBACKS.withdrawCancel)]
  ]);
}

export function withdrawalCancelKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("Cancel withdrawal", CALLBACKS.withdrawCancel)]]);
}

export function dashboardMessage(
  user: UserRecord,
  availableTaskCount: number,
  rewardedReferrals: number,
  config: AppConfig
) {
  return [
    "<b>Income Hub</b>",
    "",
    `<b>Balance:</b> ${formatRupeesFromPaise(user.balancePaise)}`,
    `<b>Available tasks:</b> ${availableTaskCount}`,
    `<b>Completed tasks:</b> ${user.completedTaskCount}`,
    `<b>Referral rewards:</b> ${rewardedReferrals}`,
    `<b>Minimum withdrawal:</b> ${formatRupeesFromPaise(config.rewards.minWithdrawalPaise)}`,
    user.pendingWithdrawalId ? `<b>Pending withdrawal:</b> ${escapeHtml(user.pendingWithdrawalId)}` : "<b>Pending withdrawal:</b> None",
    "",
    "Use the buttons below to keep earning and manage your wallet."
  ].join("\n");
}

export function taskListMessage(tasks: TaskListItem[]) {
  if (!tasks.length) {
    return [
      "<b>No tasks available right now.</b>",
      "",
      "New tasks from the admin panel will appear here automatically."
    ].join("\n");
  }

  const lines = tasks.map((task, index) => {
    const statusText = task.completionStatus === "started" ? "Started" : "Ready";
    return `${index + 1}. <b>${escapeHtml(task.title)}</b> · ${statusText} · ${formatRupeesFromPaise(task.rewardPaise)}`;
  });

  return [
    "<b>Available Tasks</b>",
    "",
    ...lines,
    "",
    "Select a task to open it."
  ].join("\n");
}

export function taskDetailMessage(task: TaskRecord, state: "not_started" | "started") {
  return [
    `<b>${escapeHtml(task.title)}</b>`,
    "",
    escapeHtml(task.description),
    "",
    `<b>Reward:</b> ${formatRupeesFromPaise(task.rewardPaise)}`,
    `<b>Status:</b> ${state === "started" ? "Started. Verify after you complete it." : "Ready to start"}`,
    "",
    "Open the task first, finish it, then tap verify."
  ].join("\n");
}

export function taskOpenedMessage(task: TaskRecord, cooldownSeconds: number) {
  return [
    `<b>${escapeHtml(task.title)}</b>`,
    "",
    "The task is now marked as started.",
    `After visiting the link, wait at least ${formatRelativeSeconds(cooldownSeconds)} before tapping verify.`,
    "",
    `<b>Reward:</b> ${formatRupeesFromPaise(task.rewardPaise)}`
  ].join("\n");
}

export function referralMessage(user: UserRecord, rewardedReferrals: number, pendingReferrals: number, config: AppConfig) {
  return [
    "<b>Referral Program</b>",
    "",
    `<b>Your referral link:</b>\n${escapeHtml(buildReferralLink(config.telegram.username, user.id))}`,
    "",
    `<b>Reward per qualified referral:</b> ${formatRupeesFromPaise(config.rewards.referralRewardPaise)}`,
    `<b>Rewarded referrals:</b> ${rewardedReferrals}`,
    `<b>Pending referrals:</b> ${pendingReferrals}`,
    "",
    "A referral reward is credited when the invited user finishes their first task."
  ].join("\n");
}

export function walletMessage(user: UserRecord, config: AppConfig) {
  return [
    "<b>Wallet</b>",
    "",
    `<b>Current balance:</b> ${formatRupeesFromPaise(user.balancePaise)}`,
    `<b>Task earnings:</b> ${formatRupeesFromPaise(user.taskEarningsPaise)}`,
    `<b>Referral earnings:</b> ${formatRupeesFromPaise(user.referralEarningsPaise)}`,
    `<b>Minimum withdrawal:</b> ${formatRupeesFromPaise(config.rewards.minWithdrawalPaise)}`,
    "",
    user.pendingWithdrawalId
      ? `Withdrawal request <b>${escapeHtml(user.pendingWithdrawalId)}</b> is still pending admin review.`
      : "You can request a withdrawal once your balance reaches the minimum."
  ].join("\n");
}

export function withdrawalPromptMessage(user: UserRecord, config: AppConfig) {
  return [
    "<b>Withdraw Funds</b>",
    "",
    `<b>Current balance:</b> ${formatRupeesFromPaise(user.balancePaise)}`,
    `<b>Minimum withdrawal:</b> ${formatRupeesFromPaise(config.rewards.minWithdrawalPaise)}`,
    "",
    "Choose a payout method to continue."
  ].join("\n");
}

export function withdrawalInputMessage(type: "UPI" | "PAYTM") {
  return type === "UPI"
    ? "Send your UPI ID now. Example: <b>name@bank</b>"
    : "Send your 10-digit Paytm number now.";
}

export function withdrawalCreatedMessage(withdrawal: WithdrawalRecord) {
  return [
    "<b>Withdrawal Requested</b>",
    "",
    `<b>Amount:</b> ${formatRupeesFromPaise(withdrawal.amountPaise)}`,
    `<b>Method:</b> ${withdrawal.payoutType}`,
    `<b>Destination:</b> ${escapeHtml(withdrawal.payoutValue)}`,
    `<b>Request ID:</b> ${escapeHtml(withdrawal.id)}`,
    "",
    "Your balance has been reserved. An admin will review this request manually."
  ].join("\n");
}
