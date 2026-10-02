import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature({ raw, timestamp, signature, now }, secret, invalidError) {
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(Math.floor(now() / 1000) - seconds) > 300) {
    throw invalidError("timestamp");
  }
  const receivedHex = String(signature ?? "").replace(/^v1=/, "");
  if (!/^[0-9a-f]{64}$/i.test(receivedHex)) throw invalidError("signature");
  const expected = createHmac("sha256", secret).update(`${seconds}.`).update(raw).digest();
  const received = Buffer.from(receivedHex, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw invalidError("signature");
  }
}
