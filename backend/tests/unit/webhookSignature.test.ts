// WHY THIS TEST EXISTS
// Webhook signatures are how a merchant proves a delivery genuinely came from
// StripeForge and was not tampered with or replayed. The scheme is Stripe-style:
// HMAC-SHA256 over `${timestamp}.${payload}`, sent as `t=<unix>,v1=<hex>`. This
// test pins the three properties that make the scheme trustworthy:
//   1. A signature we produce verifies against the same payload+secret.
//   2. Any tampering with the payload, or a wrong secret, is detected.
//   3. Signatures outside the timestamp tolerance window are rejected (replay).
// This module is pure crypto (node:crypto) — no DB/Redis — so it always runs.

import { describe, it, expect } from 'vitest';
import {
  signPayload,
  buildSignatureHeader,
  verifySignature,
} from '../../src/webhooks/signature';

const SECRET = 'whsec_test_signing_secret';
const PAYLOAD = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded' });

describe('webhook signature', () => {
  it('signPayload is deterministic for the same inputs', () => {
    const a = signPayload(PAYLOAD, SECRET, 1_700_000_000);
    const b = signPayload(PAYLOAD, SECRET, 1_700_000_000);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // hex SHA-256
  });

  it('buildSignatureHeader produces a t=..,v1=.. header that verifies', () => {
    const header = buildSignatureHeader(PAYLOAD, SECRET);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifySignature(PAYLOAD, header, SECRET)).toBe(true);
  });

  it('detects a tampered payload', () => {
    const header = buildSignatureHeader(PAYLOAD, SECRET);
    const tampered = PAYLOAD.replace('succeeded', 'failed');
    expect(verifySignature(tampered, header, SECRET)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const header = buildSignatureHeader(PAYLOAD, SECRET);
    expect(verifySignature(PAYLOAD, header, 'whsec_WRONG')).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(verifySignature(PAYLOAD, 'not-a-valid-header', SECRET)).toBe(false);
    expect(verifySignature(PAYLOAD, 't=123', SECRET)).toBe(false);
  });

  it('rejects a stale timestamp outside the tolerance window (replay defense)', () => {
    const oldTs = Math.floor(Date.now() / 1000) - 10_000; // ~2.7h ago
    const sig = signPayload(PAYLOAD, SECRET, oldTs);
    const header = `t=${oldTs},v1=${sig}`;
    // Default tolerance is 300s; 10_000s ago must fail.
    expect(verifySignature(PAYLOAD, header, SECRET)).toBe(false);
    // But with a generous tolerance the same header verifies (proves it was the
    // timestamp, not the HMAC, that caused the rejection).
    expect(verifySignature(PAYLOAD, header, SECRET, 20_000)).toBe(true);
  });
});
