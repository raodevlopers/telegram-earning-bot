import { describe, expect, it } from "vitest";
import {
  isValidGooglePlayDestination,
  isValidPaypalEmail,
  isValidPayoutDestination,
  isValidUpiId,
  parseReferralPayload,
  secondsUntilVerificationAllowed
} from "../../shared/src/validators.js";

describe("shared validators", () => {
  it("parses valid referral payloads", () => {
    expect(parseReferralPayload("ref_12345")).toBe("12345");
    expect(parseReferralPayload("invalid")).toBeNull();
  });

  it("validates payout destinations", () => {
    expect(isValidUpiId("jatin@okaxis")).toBe(true);
    expect(isValidUpiId("bad-format")).toBe(false);
    expect(isValidPaypalEmail("jatin@example.com")).toBe(true);
    expect(isValidPaypalEmail("not-an-email")).toBe(false);
    expect(isValidGooglePlayDestination("jatinplay@gmail.com")).toBe(true);
    expect(isValidGooglePlayDestination("bad")).toBe(false);
    expect(isValidPayoutDestination("UPI", "jatin@okaxis")).toBe(true);
    expect(isValidPayoutDestination("PAYPAL", "jatin@example.com")).toBe(true);
    expect(isValidPayoutDestination("GOOGLE_PLAY", "jatinplay@gmail.com")).toBe(true);
  });

  it("calculates remaining task verification cooldown", () => {
    const startedAt = new Date(Date.now() - 5_000).toISOString();
    const remaining = secondsUntilVerificationAllowed(startedAt, 15);
    expect(remaining).toBeGreaterThanOrEqual(9);
    expect(remaining).toBeLessThanOrEqual(10);
  });
});
