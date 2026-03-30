export const CALLBACKS = {
  dashboardRefresh: "dashboard:refresh",
  tasksList: "tasks:list",
  walletView: "wallet:view",
  referralView: "referral:view",
  withdrawStart: "withdraw:start",
  withdrawCancel: "withdraw:cancel",
  home: "home"
} as const;

export const taskViewCallback = (taskId: string) => `task:view:${taskId}`;
export const taskStartCallback = (taskId: string) => `task:start:${taskId}`;
export const taskProofCallback = (taskId: string) => `task:proof:${taskId}`;
export const taskClaimCallback = (taskId: string) => `task:claim:${taskId}`;
export const withdrawTypeCallback = (type: "UPI" | "PAYPAL" | "GOOGLE_PLAY") => `withdraw:type:${type}`;
