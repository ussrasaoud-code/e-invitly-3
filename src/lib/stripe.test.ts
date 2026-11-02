import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { verifyStripeSignature } from "./stripe";

describe("webhook Stripe", () => {
  const secret = "whsec_test";
  const payload = '{"type":"checkout.session.completed"}';
  const sign = (t: number, body = payload) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  it("accepte une signature valide et récente", () => {
    const now = Date.now();
    expect(verifyStripeSignature(payload, sign(Math.floor(now / 1000)), secret, now)).toBe(true);
  });
  it("refuse une signature fausse, ancienne ou absente", () => {
    const now = Date.now();
    expect(verifyStripeSignature(payload, sign(Math.floor(now / 1000), "autre"), secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, sign(Math.floor(now / 1000) - 3600), secret, now)).toBe(false);
    expect(verifyStripeSignature(payload, null, secret, now)).toBe(false);
  });
});
