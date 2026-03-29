import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.session?.authenticated) {
    return next(new AppError(401, "unauthorized", "Admin authentication is required."));
  }

  return next();
}
