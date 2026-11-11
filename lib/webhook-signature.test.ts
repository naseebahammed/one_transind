import assert from "node:assert/strict";
import test from "node:test";
import { resetWebhookReplayState, signWebhookPayload, verifyWebhookSignature } from "./webhook-signature.ts";

test("verifyWebhookSignature validates raw-body HMAC-SHA256, rejects tampering, enforces replay window, and deduplicates events", () => {
  resetWebhookReplayState();
  const secret = "whsec_test_signing_secret_987654321";
  const rawBody = '{"event":"payment.succeeded","id":"evt_01","amountQar":4500}';
  const nowMs = 1_760_000_000_000;
  const ts = Math.floor(nowMs / 1000);
  const header = signWebhookPayload(rawBody, secret, ts);

  // Valid signature and fresh event ID pass
  assert.deepEqual(
    verifyWebhookSignature({ rawBody, signatureHeader: header, secret, eventId: "evt_01", nowMilliseconds: nowMs }),
    { ok: true },
  );

  // Duplicate replay of same eventId within window is rejected
  assert.equal(
    verifyWebhookSignature({ rawBody, signatureHeader: header, secret, eventId: "evt_01", nowMilliseconds: nowMs + 1000 }).ok,
    false,
  );

  // Re-serialized / tampered body fails verification
  assert.equal(
    verifyWebhookSignature({
      rawBody: '{"event":"payment.succeeded","id":"evt_02","amountQar":999999}',
      signatureHeader: header,
      secret,
      nowMilliseconds: nowMs,
    }).ok,
    false,
  );

  // Stale timestamp outside 5-minute window fails verification
  const staleHeader = signWebhookPayload(rawBody, secret, ts - 600);
  assert.equal(
    verifyWebhookSignature({ rawBody, signatureHeader: staleHeader, secret, nowMilliseconds: nowMs }).ok,
    false,
  );

  // Wrong secret fails verification
  assert.equal(
    verifyWebhookSignature({ rawBody, signatureHeader: header, secret: "wrong_secret", nowMilliseconds: nowMs }).ok,
    false,
  );
});
