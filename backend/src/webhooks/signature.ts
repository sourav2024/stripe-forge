import { createHmac, timingSafeEqual } from 'node:crypto';

// Stripe-style webhook signing. The receiver recomputes the HMAC over
// `${timestamp}.${payload}` with the shared signing secret and compares it to
// the `v1` value in the signature header. Including the timestamp in the signed
// content, plus a tolerance window on verify, prevents replay of old payloads.

/** Compute the HMAC-SHA256 signature (hex) over `${timestamp}.${payload}`. */
export function signPayload(payload: string, secret: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

/**
 * Build the signature header value: `t=<unixSeconds>,v1=<sig>`. Sent as
 * `Webhook-Signature` on every delivery so the merchant can verify authenticity.
 */
export function buildSignatureHeader(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(payload, secret, timestamp);
  return `t=${timestamp},v1=${signature}`;
}

/** Parse a `t=..,v1=..` header into its parts. Returns null if malformed. */
function parseHeader(header: string): { timestamp: number; signature: string } | null {
  let timestamp: number | null = null;
  let signature: string | null = null;
  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = Number(value);
    if (key === 'v1') signature = value;
  }
  if (timestamp === null || Number.isNaN(timestamp) || !signature) return null;
  return { timestamp, signature };
}

/**
 * Verify a signature header against the payload. Provided for completeness and
 * for the merchant/test side of the contract. Rejects signatures whose
 * timestamp is outside `toleranceSec` to defeat replay attacks.
 */
export function verifySignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300,
): boolean {
  const parsed = parseHeader(header);
  if (!parsed) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > toleranceSec) return false;

  const expected = signPayload(payload, secret, parsed.timestamp);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(parsed.signature, 'hex');
  // Length check guards timingSafeEqual (which throws on length mismatch) and
  // the comparison itself is constant-time to avoid leaking the secret.
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
