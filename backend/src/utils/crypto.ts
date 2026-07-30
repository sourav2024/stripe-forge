import { randomBytes, createHash } from 'node:crypto';

// Cryptographic helpers for tokens and API keys. All randomness comes from
// node:crypto (CSPRNG) — never Math.random — because these values gate access
// to accounts and money movement.

/** Generate a random token as a hex string. `bytes` controls entropy (default 32 → 64 hex chars). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Deterministic SHA-256 hex digest. Used to store refresh-token hashes so a DB leak never exposes usable tokens. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Generate a Stripe-style public/secret API key pair. The public key is safe to
 * expose client-side; the secret is shown to the merchant exactly once at signup.
 */
export function generateApiKeyPair(): { public: string; secret: string } {
  return {
    public: `pk_test_${generateToken(16)}`,
    secret: `sk_test_${generateToken(24)}`,
  };
}
