import { getAuth } from "firebase-admin/auth";
import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../utils/errors.js";

export function createRequireAdmin(config: AppConfig) {
  return async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
    try {
      if (req.session?.authenticated) {
        req.adminUser = {
          uid: "legacy-session-admin",
          email: config.admin.authEmail ?? null,
          source: "session"
        };
        next();
        return;
      }

      const authHeader = req.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw new AppError(401, "unauthorized", "Admin authentication is required.");
      }

      const idToken = authHeader.slice("Bearer ".length).trim();
      if (!idToken) {
        throw new AppError(401, "unauthorized", "Admin authentication is required.");
      }

      const decodedToken = await getAuth().verifyIdToken(idToken);
      const email = typeof decodedToken.email === "string" ? decodedToken.email : null;
      const matchesConfiguredEmail = email && config.admin.authEmail ? email.toLowerCase() === config.admin.authEmail.toLowerCase() : false;
      const hasAdminClaim = decodedToken.admin === true || decodedToken.role === "admin";

      if (!hasAdminClaim && !matchesConfiguredEmail) {
        throw new AppError(403, "forbidden", "This Firebase account is not allowed to access the admin dashboard.");
      }

      req.adminUser = {
        uid: decodedToken.uid,
        email,
        source: "firebase"
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
