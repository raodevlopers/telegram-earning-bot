import type { NextFunction, Request, Response } from "express";

export function asyncHandler<T extends Request, U extends Response>(
  handler: (req: T, res: U, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: U, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}
