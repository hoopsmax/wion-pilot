import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { appendToLedger, ledgerEntry, readLedger } from './ledger.ts';
import { estimateCost } from './prices.ts';

const usage = { inputTokens: 12_000, outputTokens: 3_000 };

describe('estimateCost', () => {
  test.each([
    ['claude', 'claude-opus-5-5', 0.108],
    ['claude', 'claude-sonnet-5-5', 0.054],
    ['claude', 'claude-haiku-5-5', 0.0027],
    ['ollama', 'llama3.1', 0],
  ])('%s %s: $%d', (provider, model, dollars) => {
    expect(estimateCost(provider, model, usage)).toBe(dollars);
  });

  test('an unknown model has no price, rather than a wrong one', () => {
    expect(estimateCost('claude', 'claude-something-new', usage)).toBeUndefined();
  });
});

describe('the ledger', () => {
  test('one JSON line per call, appended, and read back', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'wion-ledger-'));
    const file = join(folder, '.wion', 'ledger.jsonl');
    try {
      expect(await readLedger(file)).toEqual([]);
      const call = {
        time: new Date('2026-11-26T10:00:00.000Z'),
        command: 'draft',
        provider: 'claude',
        model: 'claude-opus-5-5',
        usage,
        seconds: 12.345,
      };
      await appendToLedger(file, ledgerEntry(call));
      await appendToLedger(file, ledgerEntry({ ...call, model: 'claude-something-new' }));
      expect(await readLedger(file)).toEqual([
        {
          time: '2026-11-26T10:00:00.000Z',
          command: 'draft',
          provider: 'claude',
          model: 'claude-opus-5-5',
          inputTokens: 12_000,
          outputTokens: 3_000,
          seconds: 12.3,
          estimatedCostUsd: 0.108,
        },
        expect.objectContaining({ model: 'claude-something-new', estimatedCostUsd: null }),
      ]);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
