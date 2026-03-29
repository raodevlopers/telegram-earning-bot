export type Nullable<T> = T | null;

export type TaskStatus = "active" | "paused";
export type CompletionStatus = "started" | "completed";
export type WithdrawalStatus = "pending" | "approved" | "rejected";
export type PayoutType = "UPI" | "PAYTM";
export type WalletTransactionType = "task_reward" | "referral_reward" | "withdrawal_hold" | "withdrawal_refund";
export type WalletReferenceType = "task" | "referral" | "withdrawal";

export interface BotState {
  flow: "awaiting_withdrawal_destination";
  payoutType: PayoutType;
  startedAt: string;
}

export interface UserRecord {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  balancePaise: number;
  referralCode: string;
  referredBy: string | null;
  firstTaskCompletedAt: string | null;
  completedTaskCount: number;
  taskEarningsPaise: number;
  referralCount: number;
  referralEarningsPaise: number;
  pendingWithdrawalId: string | null;
  riskFlags: string[];
  botState: BotState | null;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  link: string;
  rewardPaise: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCompletionRecord {
  id: string;
  userId: string;
  taskId: string;
  status: CompletionStatus;
  startedAt: string;
  completedAt: string | null;
  rewardPaise: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referredId: string;
  rewardGranted: boolean;
  rewardedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  amountPaise: number;
  payoutType: PayoutType;
  payoutValue: string;
  status: WithdrawalStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
}

export interface WalletTransactionRecord {
  id: string;
  userId: string;
  type: WalletTransactionType;
  amountPaise: number;
  balanceAfterPaise: number;
  referenceType: WalletReferenceType;
  referenceId: string;
  createdAt: string;
}

export interface PlatformStatsRecord {
  id: string;
  completedTaskCount: number;
  totalTaskRewardsPaise: number;
  rewardedReferralCount: number;
  totalReferralRewardsPaise: number;
  pendingWithdrawalCount: number;
  approvedWithdrawalCount: number;
  rejectedWithdrawalCount: number;
  totalWithdrawnPaise: number;
  updatedAt: string;
}

export interface TaskListItem extends TaskRecord {
  completionStatus: "not_started" | "started";
  startedAt: string | null;
}

export interface ReferralInsightRecord extends ReferralRecord {
  referrerDisplayName: string;
  referrerUsername: string | null;
  referredDisplayName: string;
  referredUsername: string | null;
}

export interface AdminOverview {
  userCount: number;
  totalTaskCount: number;
  activeTaskCount: number;
  pendingWithdrawalCount: number;
  completedTaskCount: number;
  totalTaskRewardsPaise: number;
  rewardedReferralCount: number;
  totalReferralRewardsPaise: number;
  totalEarningsPaise: number;
  approvedWithdrawalCount: number;
  totalWithdrawnPaise: number;
}

export interface CompletedTaskInsightRecord {
  id: string;
  userId: string;
  userDisplayName: string;
  username: string | null;
  taskId: string;
  taskTitle: string;
  rewardPaise: number;
  completedAt: string;
  startedAt: string;
}

export interface UserDetailResponse {
  user: UserRecord;
  referrals: ReferralInsightRecord[];
  withdrawals: WithdrawalRecord[];
  walletTransactions: WalletTransactionRecord[];
}

export interface TelegramProfile {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}
