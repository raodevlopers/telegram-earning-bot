import { Router } from "express";
import type { Telegraf } from "telegraf";
import type { Update } from "telegraf/types";
import type { AppConfig } from "../config/env.js";
import { asyncHandler } from "../middlewares/async-handler.js";
import { AppError } from "../utils/errors.js";

export function createTelegramRouter(bot: Telegraf, config: AppConfig) {
  const router = Router();

  router.post(
    "/webhook",
    asyncHandler(async (req, res) => {
      const secret = req.get("x-telegram-bot-api-secret-token");
      if (secret !== config.telegram.webhookSecret) {
        throw new AppError(401, "invalid_webhook_secret", "Invalid Telegram webhook secret.");
      }

      await bot.handleUpdate(req.body as Update);
      res.sendStatus(200);
    })
  );

  return router;
}
