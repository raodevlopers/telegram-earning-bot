import type { Firestore } from "firebase-admin/firestore";
import type { Logger } from "pino";
import type { Telegraf } from "telegraf";
import type { AppConfig } from "../config/env.js";
import type { AdminService } from "../services/admin-service.js";
import type { TaskService } from "../services/task-service.js";
import type { UserService } from "../services/user-service.js";
import type { WithdrawalService } from "../services/withdrawal-service.js";

export interface AppServices {
  db: Firestore;
  logger: Logger;
  config: AppConfig;
  userService: UserService;
  taskService: TaskService;
  withdrawalService: WithdrawalService;
  adminService: AdminService;
  bot: Telegraf;
}
