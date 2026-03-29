import { describe, expect, it } from "vitest";
import { parseReferralPayload, isValidPaytmNumber, isValidUpiId, secondsUntilVerificationAllowed } from "../../shared/src/validators.js";

describe("shared validators", () => {
  it("parses valid referral payloads", () => {
    expect(parseReferralPayload("ref_12345")).toBe("12345");
    expect(parseReferralPayload("invalid")).toBeNull();
  });

  it("validates UPI and Paytm destinations", () => {
    expect(isValidUpiId("jatin@okaxis")).toBe(true);
    expect(isValidUpiId("bad-format")).toBe(false);
    expect(isValidPaytmNumber("9876543210")).toBe(true);
    expect(isValidPaytmNumber("1234")).toBe(false);
  });

  it("calculates remaining task verification cooldown", () => {
    const startedAt = new Date(Date.now() - 5_000).toISOString();
    const remaining = secondsUntilVerificationAllowed(startedAt, 15);
    expect(remaining).toBeGreaterThanOrEqual(9);
    expect(remaining).toBeLessThanOrEqual(10);
  });
});
