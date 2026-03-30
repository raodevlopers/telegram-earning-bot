import compression from "compression";
import cookieSession from "cookie-session";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import type { AppServices } from "./types/app-services.js";
import { createAdminRouter } from "./routes/admin.js";
import { createPublicRouter } from "./routes/public.js";
import { createTelegramRouter } from "./routes/telegram.js";
import { createErrorHandler } from "./middlewares/error-handler.js";
import { AppError } from "./utils/errors.js";

export function createApp(services: AppServices) {
  const app = express();
  const adminDistPath = path.resolve(process.cwd(), "admin", "dist");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    pino({
      logger: services.logger,
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) {
          return "error";
        }

        if (res.statusCode >= 400) {
          return "warn";
        }

        return "info";
      }
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(compression());
  if (services.config.admin.origin) {
    app.use(
      cors({
        origin: services.config.admin.origin,
        credentials: true
      })
    );
  }
  app.use(express.json({ limit: "15mb" }));
  app.use(
    cookieSession({
      name: services.config.admin.cookieName,
      secret: services.config.admin.sessionSecret,
      sameSite: services.config.admin.origin ? "none" : "lax",
      httpOnly: true,
      secure: services.config.isProduction || Boolean(services.config.admin.origin),
      maxAge: 1000 * 60 * 60 * 12
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(createPublicRouter(services));
  app.use("/api/admin", createAdminRouter(services));
  app.use("/telegram", createTelegramRouter(services.bot, services.config));

  if (existsSync(adminDistPath)) {
    app.use(express.static(adminDistPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/telegram")) {
        next();
        return;
      }

      res.sendFile(path.join(adminDistPath, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.type("text/plain").send("Admin app has not been built yet.");
    });
  }

  app.use((_req, _res, next) => {
    next(new AppError(404, "not_found", "Route not found."));
  });
  app.use(createErrorHandler(services.logger));

  return app;
}
