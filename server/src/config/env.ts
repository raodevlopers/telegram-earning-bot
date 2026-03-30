import { config as loadEnv } from "dotenv";
import { z } from "zod";
import {
  DEFAULT_DAILY_REMINDER_MAX,
  DEFAULT_DAILY_REMINDER_MIN,
  DEFAULT_MIN_WITHDRAWAL_PAISE,
  DEFAULT_REFERRAL_REWARD_PAISE,
  DEFAULT_TASK_REWARD_PAISE,
  DEFAULT_TASK_TIMER_SECONDS,
  DEFAULT_TASK_VERIFY_COOLDOWN_SECONDS
} from "../../../shared/src/constants.js";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  WEBHOOK_BASE_URL: z.string().url(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(12),
  BOT_TOKEN: z.string().min(20),
  BOT_USERNAME: z.string().min(3),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().min(20),
  SESSION_SECRET: z.string().min(16),
  ADMIN_ORIGIN: z.string().url().optional(),
  ADMIN_AUTH_EMAIL: z.string().email().optional(),
  IMGBB_API_KEY: z.string().min(10),
  TASK_REWARD_PAISE: z.coerce.number().int().positive().default(DEFAULT_TASK_REWARD_PAISE),
  REFERRAL_REWARD_PAISE: z.coerce.number().int().positive().default(DEFAULT_REFERRAL_REWARD_PAISE),
  MIN_WITHDRAWAL_PAISE: z.coerce.number().int().positive().default(DEFAULT_MIN_WITHDRAWAL_PAISE),
  TASK_VERIFY_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(DEFAULT_TASK_VERIFY_COOLDOWN_SECONDS),
  TASK_TIMER_SECONDS: z.coerce.number().int().positive().default(DEFAULT_TASK_TIMER_SECONDS),
  DAILY_REMINDER_MIN: z.coerce.number().int().min(1).max(10).default(DEFAULT_DAILY_REMINDER_MIN),
  DAILY_REMINDER_MAX: z.coerce.number().int().min(1).max(10).default(DEFAULT_DAILY_REMINDER_MAX),
  REMINDER_SCAN_INTERVAL_MS: z.coerce.number().int().min(60_000).default(15 * 60 * 1000)
});

export interface AppConfig {
  env: "development" | "production" | "test";
  isProduction: boolean;
  port: number;
  telegram: {
    token: string;
    username: string;
    webhookBaseUrl: string;
    webhookSecret: string;
  };
  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  media: {
    imgbbApiKey: string;
  };
  admin: {
    passwordHash: string;
    sessionSecret: string;
    cookieName: string;
    origin?: string;
    authEmail?: string;
  };
  rewards: {
    taskRewardPaise: number;
    referralRewardPaise: number;
    minWithdrawalPaise: number;
    taskVerifyCooldownSeconds: number;
    taskTimerSeconds: number;
  };
  reminders: {
    minPerDay: number;
    maxPerDay: number;
    scanIntervalMs: number;
  };
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.parse(process.env);

  cachedConfig = {
    env: parsed.NODE_ENV,
    isProduction: parsed.NODE_ENV === "production",
    port: parsed.PORT,
    telegram: {
      token: parsed.BOT_TOKEN,
      username: parsed.BOT_USERNAME,
      webhookBaseUrl: parsed.WEBHOOK_BASE_URL,
      webhookSecret: parsed.TELEGRAM_WEBHOOK_SECRET
    },
    firebase: {
      projectId: parsed.FIREBASE_PROJECT_ID,
      clientEmail: parsed.FIREBASE_CLIENT_EMAIL,
      privateKey: parsed.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    },
    media: {
      imgbbApiKey: parsed.IMGBB_API_KEY
    },
    admin: {
      passwordHash: parsed.ADMIN_PASSWORD_HASH,
      sessionSecret: parsed.SESSION_SECRET,
      cookieName: "earning_bot_admin",
      origin: parsed.ADMIN_ORIGIN,
      authEmail: parsed.ADMIN_AUTH_EMAIL
    },
    rewards: {
      taskRewardPaise: parsed.TASK_REWARD_PAISE,
      referralRewardPaise: parsed.REFERRAL_REWARD_PAISE,
      minWithdrawalPaise: parsed.MIN_WITHDRAWAL_PAISE,
      taskVerifyCooldownSeconds: parsed.TASK_VERIFY_COOLDOWN_SECONDS,
      taskTimerSeconds: parsed.TASK_TIMER_SECONDS
    },
    reminders: {
      minPerDay: parsed.DAILY_REMINDER_MIN,
      maxPerDay: parsed.DAILY_REMINDER_MAX,
      scanIntervalMs: parsed.REMINDER_SCAN_INTERVAL_MS
    }
  };

  return cachedConfig;
}
