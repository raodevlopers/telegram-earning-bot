import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        uid: string;
        email: string | null;
        source: "session" | "firebase";
      };
    }

    interface Request {
      id?: string;
      log?: Logger;
    }
  }
}

export {};
