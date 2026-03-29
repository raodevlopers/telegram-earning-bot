export const COLLECTIONS = {
  users: "users",
  tasks: "tasks",
  taskCompletions: "taskCompletions",
  referrals: "referrals",
  withdrawals: "withdrawals",
  walletTransactions: "walletTransactions",
  stats: "stats"
} as const;

export const PLATFORM_STATS_DOC_ID = "platform";

export const DEFAULT_TASK_REWARD_PAISE = 1_000;
export const DEFAULT_REFERRAL_REWARD_PAISE = 500;
export const DEFAULT_MIN_WITHDRAWAL_PAISE = 3_000;
export const DEFAULT_TASK_VERIFY_COOLDOWN_SECONDS = 15;
export const ADMIN_POLL_INTERVAL_MS = 20_000;

export const RISK_FLAGS = {
  selfReferralAttempt: "self_referral_attempt",
  invalidReferrer: "invalid_referrer",
  cooldownBypassAttempt: "cooldown_bypass_attempt"
} as const;
