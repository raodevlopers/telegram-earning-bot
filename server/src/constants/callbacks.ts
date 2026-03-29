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
export const taskOpenCallback = (taskId: string) => `task:open:${taskId}`;
export const taskVerifyCallback = (taskId: string) => `task:verify:${taskId}`;
export const withdrawTypeCallback = (type: "UPI" | "PAYTM") => `withdraw:type:${type}`;
