import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readAnswer } from './review-command.ts';

const cli = join(import.meta.dirname, 'main.ts');

describe('readAnswer', () => {
  test.each([
    ['y', 'yes'],
    ['Y', 'yes'],
    ['yes', 'yes'],
    ['[y]', 'yes'],
    [' n ', 'no'],
    ['s', 'skip'],
    ['q', 'quit'],
    ['', 'empty'],
    ['  ', 'empty'],
    ['maybe', 'unknown'],
  ])('"%s" means %s', (reply, answer) => {
    expect(readAnswer(reply)).toBe(answer);
  });
});

describe('wion review in a terminal', () => {
  // A terminal's input never ends by itself, unlike a pipe in a test. Review must still return
  // to the shell when it is done, or the next command typed goes into review instead.
  test('ends by itself while the input stays open', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'wion-review-tty-'));
    try {
      const child = spawn(process.execPath, [cli, 'review', '--wion-dir', folder], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const exitCode = await new Promise<number | null>((resolve) => {
        const timer = setTimeout(() => {
          child.kill();
          resolve(null);
        }, 10_000);
        child.on('exit', (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });
      expect(exitCode, 'review returned to the shell').toBe(0);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }, 20_000);
});
