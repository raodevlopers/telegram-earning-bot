import { Markup } from "telegraf";
import { buildReferralLink, formatRelativeSeconds, formatRupeesFromPaise, formatTaskType } from "../../../shared/src/format.js";
import type { AppConfig } from "../config/env.js";
import {
  CALLBACKS,
  taskClaimCallback,
  taskProofCallback,
  taskStartCallback,
  taskViewCallback,
  withdrawTypeCallback
} from "../constants/callbacks.js";
import type { PayoutType, TaskCompletionRecord, TaskListItem, TaskRecord, UserRecord, WithdrawalRecord } from "../../../shared/src/types.js";
import { escapeHtml } from "../utils/telegram.js";

export function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Refresh", CALLBACKS.dashboardRefresh),
      Markup.button.callback("Tasks", CALLBACKS.tasksList)
    ],
    [
      Markup.button.callback("Refer & Earn", CALLBACKS.referralView),
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

export function taskDetailKeyboard(taskId: string, sessionUrl: string | null) {
  const rows = [];
  if (sessionUrl) {
    rows.push([Markup.button.url("Open task page", sessionUrl)]);
  } else {
    rows.push([Markup.button.callback("Start task", taskStartCallback(taskId))]);
  }

  rows.push([Markup.button.callback("Upload screenshot proof", taskProofCallback(taskId))]);
  rows.push([Markup.button.callback("Claim reward", taskClaimCallback(taskId))]);
  rows.push([Markup.button.callback("Back to tasks", CALLBACKS.tasksList)]);
  return Markup.inlineKeyboard(rows);
}

export function taskStartedKeyboard(taskId: string, sessionUrl: string) {
  return Markup.inlineKeyboard([
    [Markup.button.url("Open task page", sessionUrl)],
    [Markup.button.callback("Upload screenshot proof", taskProofCallback(taskId))],
    [Markup.button.callback("Claim reward", taskClaimCallback(taskId))],
    [Markup.button.callback("Back to tasks", CALLBACKS.tasksList)]
  ]);
}

export function withdrawalTypeKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("UPI", withdrawTypeCallback("UPI")),
      Markup.button.callback("PayPal", withdrawTypeCallback("PAYPAL"))
    ],
    [Markup.button.callback("Google Play", withdrawTypeCallback("GOOGLE_PLAY"))],
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
    `<b>Hi ${escapeHtml(user.firstName?.trim() || user.displayName)} 👋</b>`,
    "",
    "<b>Income Hub Dashboard</b>",
    "",
    `💰 <b>Balance:</b> ${formatRupeesFromPaise(user.balancePaise)}`,
    `🧩 <b>Available tasks:</b> ${availableTaskCount}`,
    `✅ <b>Completed tasks:</b> ${user.completedTaskCount}`,
    `🤝 <b>Referral rewards:</b> ${rewardedReferrals}`,
    `🏁 <b>Withdrawal goal:</b> ${formatRupeesFromPaise(config.rewards.minWithdrawalPaise)}`,
    user.pendingWithdrawalId ? `⏳ <b>Pending withdrawal:</b> ${escapeHtml(user.pendingWithdrawalId)}` : "⏳ <b>Pending withdrawal:</b> None",
    "",
    availableTaskCount
      ? "Tap <b>Tasks</b> and start earning now."
      : "Out of tasks for now. Refer friends to add Rs 5 and reach your first withdrawal faster."
  ].join("\n");
}

export function taskListMessage(tasks: TaskListItem[]) {
  if (!tasks.length) {
    return [
      "<b>No tasks available right now 😴</b>",
      "",
      "Admin jaise hi naye tasks publish karega, wo yahan aa jayenge.",
      "",
      "Tab tak referral share karo aur next earning wave ka wait karo."
    ].join("\n");
  }

  const lines = tasks.map((task, index) => {
    const statusText = task.completionStatus === "started" ? "In progress" : "Ready";
    return `${index + 1}. <b>${escapeHtml(task.title)}</b> | ${formatTaskType(task.taskType)} | ${statusText} | ${formatRupeesFromPaise(task.rewardPaise)}`;
  });

  return [
    "<b>Available Tasks 🚀</b>",
    "",
    ...lines,
    "",
    "Task select karo, step-by-step guide follow karo, screenshot proof bhejo aur reward claim karo."
  ].join("\n");
}

export function taskDetailMessage(task: TaskRecord, completion: TaskCompletionRecord | null) {
  const proofStatus = task.proofRequired ? (completion?.proofImageUrl ? "Uploaded" : "Pending") : "Not needed";
  const timerStatus = completion?.timerQualifiedAt ? "Completed" : completion?.timerStartedAt ? "Running" : "Pending";

  return [
    `<b>${escapeHtml(task.title)}</b>`,
    `<b>${escapeHtml(formatTaskType(task.taskType))}</b>`,
    "",
    `📝 ${escapeHtml(task.description)}`,
    task.caption ? `\n<b>Caption to copy:</b>\n<code>${escapeHtml(task.caption)}</code>` : "",
    "",
    `💸 <b>Reward:</b> ${formatRupeesFromPaise(task.rewardPaise)}`,
    `⏱ <b>Timer:</b> ${formatRelativeSeconds(task.timerSeconds)}`,
    `📸 <b>Proof:</b> ${proofStatus}`,
    `🌐 <b>Browser timer:</b> ${timerStatus}`,
    "",
    task.taskType === "maps_review"
      ? "Flow: task page kholo, review post karo, screenshot bhejo, phir 30 second timer complete karke reward claim karo."
      : "Flow: task page kholo, Chrome/Google browser me visit complete karo, screenshot bhejo, phir reward claim karo."
  ]
    .filter(Boolean)
    .join("\n");
}

export function taskStartedMessage(task: TaskRecord) {
  return [
    `<b>${escapeHtml(task.title)}</b>`,
    "",
    "Task ab start ho chuka hai ✅",
    `🌐 Browser step duration: ${formatRelativeSeconds(task.timerSeconds)}`,
    task.taskType === "maps_review"
      ? "Review post karne ke baad screenshot proof bhejo. Proof ke baad timer page unlock ho jayega."
      : "Task page kholo, browser visit complete karo, phir screenshot proof bhejo aur reward claim karo.",
    "",
    "Telegram in-app browser ki jagah Chrome ya Google browser use karna best rahega."
  ].join("\n");
}

export function taskProofPromptMessage(task: TaskRecord) {
  return [
    `<b>${escapeHtml(task.title)}</b>`,
    "",
    "Ab apna screenshot proof as a photo bhejo 📸",
    "Screenshot me task clearly visible hona chahiye.",
    "",
    task.taskType === "maps_review"
      ? "Maps review aur uploaded photos ka proof screenshot bhejna hai."
      : "Visited page ya result page ka screenshot bhejna hai."
  ].join("\n");
}

export function taskProofReceivedMessage(task: TaskRecord, sessionUrl: string | null) {
  return [
    `Proof received for <b>${escapeHtml(task.title)}</b> ✅`,
    "",
    task.taskType === "maps_review"
      ? "Ab 30-second verification timer complete karo, phir reward claim ho jayega."
      : "Browser timer qualify ho chuka ho to ab reward claim kar sakte ho. Zarurat ho to task page dubara kholo.",
    sessionUrl ? `\nTask page: ${escapeHtml(sessionUrl)}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function taskCompletedMessage(task: TaskRecord, newBalancePaise: number, availableTaskCount: number) {
  return [
    `<b>Task completed 🎉</b>`,
    "",
    `You got <b>${formatRupeesFromPaise(task.rewardPaise)}</b> for <b>${escapeHtml(task.title)}</b>.`,
    `💰 New balance: <b>${formatRupeesFromPaise(newBalancePaise)}</b>`,
    "",
    availableTaskCount
      ? "Next task ready hai. Continue karo aur earning badhao."
      : "Out of tasks for now. Want more earning? Refer a friend and add Rs 5 toward your first withdrawal."
  ].join("\n");
}

export function taskTimerPendingMessage(secondsRemaining: number) {
  return [
    "<b>Task not ready yet ⏳</b>",
    "",
    `Abhi bhi around <b>${formatRelativeSeconds(secondsRemaining)}</b> pending hain.`,
    "Task page pe timer complete karke phir reward claim karo."
  ].join("\n");
}

export function taskProofRequiredMessage() {
  return [
    "<b>Screenshot proof missing 📸</b>",
    "",
    "Reward claim karne se pehle screenshot upload karna zaroori hai."
  ].join("\n");
}

export function referralMessage(user: UserRecord, rewardedReferrals: number, pendingReferrals: number, config: AppConfig) {
  return [
    "<b>Referral Zone 🤝</b>",
    "",
    `<b>Your referral link:</b>\n${escapeHtml(buildReferralLink(config.telegram.username, user.id))}`,
    "",
    `💸 <b>Reward per referral:</b> ${formatRupeesFromPaise(config.rewards.referralRewardPaise)}`,
    `✅ <b>Rewarded referrals:</b> ${rewardedReferrals}`,
    `🕒 <b>Pending referrals:</b> ${pendingReferrals}`,
    "",
    "Jab invited user apna first task complete karta hai, tab referral reward credit hota hai."
  ].join("\n");
}

export function walletMessage(user: UserRecord, config: AppConfig) {
  return [
    "<b>Wallet 💼</b>",
    "",
    `💰 <b>Current balance:</b> ${formatRupeesFromPaise(user.balancePaise)}`,
    `🧩 <b>Task earnings:</b> ${formatRupeesFromPaise(user.taskEarningsPaise)}`,
    `🤝 <b>Referral earnings:</b> ${formatRupeesFromPaise(user.referralEarningsPaise)}`,
    `🏁 <b>Minimum withdrawal:</b> ${formatRupeesFromPaise(config.rewards.minWithdrawalPaise)}`,
    "",
    user.pendingWithdrawalId
      ? `Withdrawal request <b>${escapeHtml(user.pendingWithdrawalId)}</b> admin review me hai.`
      : "Balance Rs 35 ya usse zyada hote hi withdrawal request bhej sakte ho."
  ].join("\n");
}

export function withdrawalPromptMessage(user: UserRecord, config: AppConfig) {
  return [
    "<b>Withdraw Funds 💸</b>",
    "",
    `💰 <b>Current balance:</b> ${formatRupeesFromPaise(user.balancePaise)}`,
    `🏁 <b>Minimum withdrawal:</b> ${formatRupeesFromPaise(config.rewards.minWithdrawalPaise)}`,
    "",
    "Method choose karo: UPI, PayPal, ya Google Play redeem code."
  ].join("\n");
}

export function withdrawalInputMessage(type: PayoutType) {
  if (type === "UPI") {
    return "Apni UPI ID bhejo. Example: <b>name@bank</b>";
  }

  if (type === "PAYPAL") {
    return "Apna PayPal email bhejo. Example: <b>name@example.com</b>";
  }

  return "Apna Gmail ya preferred note bhejo jahan Google Play redeem code deliver karna hai.";
}

export function withdrawalCreatedMessage(withdrawal: WithdrawalRecord) {
  return [
    "<b>Withdrawal Requested ✅</b>",
    "",
    `💸 <b>Amount:</b> ${formatRupeesFromPaise(withdrawal.amountPaise)}`,
    `🏦 <b>Method:</b> ${withdrawal.payoutType}`,
    `📨 <b>Destination:</b> ${escapeHtml(withdrawal.payoutValue)}`,
    `🧾 <b>Request ID:</b> ${escapeHtml(withdrawal.id)}`,
    "",
    "Admin panel me request bhej di gayi hai. 10-15 minutes wait karo, payment processing chal rahi hai."
  ].join("\n");
}
