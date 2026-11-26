import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { estimateCost, type Usage } from './prices.ts';

/** One line of .wion/ledger.jsonl: one real AI call. */
export interface LedgerEntry {
  time: string;
  command: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  seconds: number;
  /** null when the model's price is not known. */
  estimatedCostUsd: number | null;
  /** Why the call failed, when it did (a timeout, say); its tokens are then unknown, so 0. */
  failed?: string;
}

export function ledgerEntry(call: {
  time: Date;
  command: string;
  provider: string;
  model: string;
  usage: Usage;
  seconds: number;
  failed?: string;
}): LedgerEntry {
  return {
    ...(call.failed === undefined ? {} : { failed: call.failed }),
    time: call.time.toISOString(),
    command: call.command,
    provider: call.provider,
    model: call.model,
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
    seconds: Math.round(call.seconds * 10) / 10,
    estimatedCostUsd: estimateCost(call.provider, call.model, call.usage) ?? null,
  };
}

/** Appends one line; the file only ever grows, so no call is lost or rewritten. */
export async function appendToLedger(file: string, entry: LedgerEntry): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(entry)}\n`);
}

export async function readLedger(file: string): Promise<LedgerEntry[]> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as LedgerEntry);
}
