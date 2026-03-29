import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { AppError } from "../utils/errors.js";

export function createErrorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const appError = error instanceof AppError ? error : new AppError(500, "internal_error", "Something went wrong.");
    const requestLogger = req.log ?? logger;

    requestLogger.error(
      {
        err: error,
        requestId: req.id,
        path: req.path,
        method: req.method
      },
      "request_failed"
    );

    res.status(appError.statusCode).json({
      error: appError.code,
      message: appError.message,
      requestId: req.id
    });
  };
}
