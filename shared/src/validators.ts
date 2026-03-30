import type { PayoutType } from "./types.js";

export function parseReferralPayload(payload: string | null | undefined): string | null {
  if (!payload) {
    return null;
  }

  const match = payload.match(/^ref_(\d+)$/);
  return match?.[1] ?? null;
}

export function buildReferralCode(userId: string): string {
  return `REF${userId}`;
}

export function isValidUpiId(value: string): boolean {
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(value.trim());
}

export function isValidPaytmNumber(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.trim());
}

export function isValidPaypalEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidGooglePlayDestination(value: string): boolean {
  return value.trim().length >= 5 && value.trim().length <= 120;
}

export function isValidPayoutDestination(type: PayoutType, value: string): boolean {
  if (type === "UPI") {
    return isValidUpiId(value);
  }

  if (type === "PAYPAL") {
    return isValidPaypalEmail(value);
  }

  return isValidGooglePlayDestination(value);
}

export function secondsUntilVerificationAllowed(startedAt: string, cooldownSeconds: number): number {
  const elapsedMs = Date.now() - Date.parse(startedAt);
  const remaining = cooldownSeconds - Math.floor(elapsedMs / 1000);
  return Math.max(0, remaining);
}
