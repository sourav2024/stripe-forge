// WHY THIS TEST EXISTS
// Money in StripeForge is stored as BigInt minor units. JSON.stringify throws on
// BigInt, so every API payload is run through `serialize()` at the boundary. This
// util is the single point that keeps the entire money pipeline JSON-safe — if it
// regresses, EVERY endpoint that returns an amount breaks. These tests pin down
// its contract: BigInt -> number, recursively, through objects/arrays/nesting,
// while leaving all other values untouched.

import { describe, it, expect } from 'vitest';
import { serialize } from '../../src/utils/serialize';

describe('serialize (BigInt -> number)', () => {
  it('converts a top-level BigInt to a number', () => {
    expect(serialize(1234n)).toBe(1234);
  });

  it('converts BigInt fields inside a flat object', () => {
    const out = serialize({ amount: 500n, currency: 'usd' });
    expect(out).toEqual({ amount: 500, currency: 'usd' });
    expect(typeof out.amount).toBe('number');
  });

  it('converts BigInt inside arrays', () => {
    expect(serialize([1n, 2n, 3n])).toEqual([1, 2, 3]);
  });

  it('recurses through deeply nested structures', () => {
    const input = {
      payment: {
        amount: 2000n,
        refunds: [{ amount: 500n }, { amount: 250n }],
        meta: { total: 750n },
      },
    };
    expect(serialize(input)).toEqual({
      payment: {
        amount: 2000,
        refunds: [{ amount: 500 }, { amount: 250 }],
        meta: { total: 750 },
      },
    });
  });

  it('leaves non-BigInt values untouched', () => {
    const input = { s: 'text', n: 42, b: true, nil: null };
    expect(serialize(input)).toEqual(input);
  });

  it('preserves zero as a number (0n -> 0), not undefined/null', () => {
    const out = serialize({ amountRefunded: 0n });
    expect(out.amountRefunded).toBe(0);
    expect(typeof out.amountRefunded).toBe('number');
  });

  it('preserves precision for large but safe integer amounts', () => {
    // $92,233,720,368 in cents — well within Number.MAX_SAFE_INTEGER.
    const cents = 9223372036800n;
    expect(serialize({ amount: cents }).amount).toBe(9223372036800);
  });
});
