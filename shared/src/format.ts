import type { TelegramProfile } from "./types.js";

export function formatRupeesFromPaise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value / 100);
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatRelativeSeconds(seconds: number): string {
  if (seconds <= 1) {
    return "1 second";
  }

  return `${seconds} seconds`;
}

export function buildReferralLink(botUsername: string, telegramId: string): string {
  return `https://t.me/${botUsername}?start=ref_${telegramId}`;
}

export function buildDisplayName(profile: TelegramProfile): string {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (profile.username) {
    return `@${profile.username}`;
  }

  return `User ${profile.id}`;
}
