// WHY THIS TEST EXISTS
// `parsePagination` is the guard that stops a client from requesting an unbounded
// page and exhausting server memory / hammering the DB. Its bounds logic (floor
// of 1, ceiling of 100, default page 1 / pageSize 20, correct `skip`) is easy to
// break with an off-by-one, so it is pinned here. This is a pure function with no
// I/O, making it a perfect fast unit test.

import { describe, it, expect } from 'vitest';
import { parsePagination } from '../../src/utils/http';

describe('parsePagination', () => {
  it('applies defaults when no query params are given', () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 });
  });

  it('computes skip from page and pageSize', () => {
    expect(parsePagination({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      skip: 20,
      take: 10,
    });
  });

  it('coerces numeric strings (query params arrive as strings)', () => {
    expect(parsePagination({ page: '2', pageSize: '25' })).toEqual({
      page: 2,
      pageSize: 25,
      skip: 25,
      take: 25,
    });
  });

  it('clamps pageSize to a maximum of 100', () => {
    expect(parsePagination({ pageSize: 5000 }).pageSize).toBe(100);
  });

  it('floors page to a minimum of 1', () => {
    expect(parsePagination({ page: 0 }).page).toBe(1);
    expect(parsePagination({ page: -7 }).page).toBe(1);
  });

  it('floors a negative pageSize to a minimum of 1', () => {
    expect(parsePagination({ pageSize: -3 }).pageSize).toBe(1);
  });

  it('treats pageSize=0 as "unset" and applies the default (falsy 0)', () => {
    // `Number(0) || 20` is 20 because 0 is falsy — an intentional consequence of
    // the "|| default" idiom. Documented here so the behaviour is explicit.
    expect(parsePagination({ pageSize: 0 }).pageSize).toBe(20);
  });

  it('falls back to defaults for non-numeric input', () => {
    expect(parsePagination({ page: 'abc', pageSize: 'xyz' })).toEqual({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
    });
  });
});
