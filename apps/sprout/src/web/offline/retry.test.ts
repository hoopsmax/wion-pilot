import { describe, expect, test } from 'vitest';
import { retryDelay, RETRY_EVERY_MS } from './retry.ts';

describe('retryDelay', () => {
  test('doubles from one second, up to the regular round', () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 10_000, 10_000]);
    expect(retryDelay(50)).toBe(RETRY_EVERY_MS);
  });
});
