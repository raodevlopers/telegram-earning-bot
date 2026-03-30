import { createServer } from "node:http";
import pino from "pino";
import { createApp } from "./app.js";
import { getConfig } from "./config/env.js";
import { createFirestore } from "./data/firestore.js";
import { AdminService } from "./services/admin-service.js";
import { ImageHostingService } from "./services/image-hosting-service.js";
import { ReminderService } from "./services/reminder-service.js";
import { TaskService } from "./services/task-service.js";
import { UserService } from "./services/user-service.js";
import { WithdrawalService } from "./services/withdrawal-service.js";
import { createBot, initializeBot } from "./telegram/bot.js";
import type { AppServices } from "./types/app-services.js";

async function bootstrap() {
  const config = getConfig();
  const logger = pino({
    level: config.env === "development" ? "debug" : "info"
  });
  const db = createFirestore(config);

  const baseServices = {
    db,
    logger,
    config,
    userService: new UserService(db, config, logger),
    taskService: new TaskService(db, config, logger),
    withdrawalService: new WithdrawalService(db, config, logger),
    adminService: new AdminService(db, logger),
    imageHostingService: new ImageHostingService(config, logger)
  };

  const bot = createBot(baseServices);
  const reminderService = new ReminderService(bot, baseServices.userService, config, logger);
  const services: AppServices = { ...baseServices, bot, reminderService };
  const app = createApp(services);
  const server = createServer(app);

  await verifyRuntimeDependencies(services);

  server.listen(config.port, async () => {
    logger.info({ port: config.port }, "server_started");
    await initializeBot(services);
    reminderService.start();
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutdown_requested");
    reminderService.stop();
    bot.stop(signal);
    server.close(() => {
      logger.info("server_stopped");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function verifyRuntimeDependencies(services: AppServices) {
  await services.db.listCollections();
  const me = await services.bot.telegram.getMe();
  services.logger.info({ botUsername: me.username, botId: me.id }, "runtime_preflight_ok");
}

void bootstrap();
