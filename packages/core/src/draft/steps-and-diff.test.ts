import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { checkDiffSize, readDiff } from './diff.ts';
import { parseStepList } from './steps.ts';

const git = promisify(execFile);

describe('parseStepList', () => {
  test('keeps the step lines of bddgen export', () => {
    const output = [
      'Using config: playwright.config.ts',
      'List of all steps (2):',
      '* Given {word} is signed in',
      "* Then {word}'s banner says {string}",
      '',
    ].join('\n');
    expect(parseStepList(output)).toEqual([
      'Given {word} is signed in',
      "Then {word}'s banner says {string}",
    ]);
  });
});

describe('checkDiffSize', () => {
  test('an empty change is refused', () => {
    expect(() => checkDiffSize('  \n', 'main')).toThrow(/no change in apps\/ since main/);
  });

  test('a change over the limit is refused as a whole, never cut', () => {
    expect(() => checkDiffSize('x'.repeat(11), 'main', 10)).toThrow(
      /11 characters, over the limit/,
    );
  });
});

describe('readDiff', () => {
  test('reads only app code changed since the base', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'wion-diff-'));
    try {
      const run = (...args: string[]) => git('git', args, { cwd: repo });
      await run('init', '-q', '-b', 'main');
      await mkdir(join(repo, 'apps'));
      await writeFile(join(repo, 'apps', 'plant.ts'), 'export const a = 1;\n');
      await writeFile(join(repo, 'notes.md'), 'old\n');
      await run('add', '.');
      await run('-c', 'user.email=t@example.test', '-c', 'user.name=t', 'commit', '-qm', 'one');
      await writeFile(join(repo, 'apps', 'plant.ts'), 'export const a = 2;\n');
      await writeFile(join(repo, 'notes.md'), 'new\n');

      const diff = await readDiff(repo, 'main');
      expect(diff).toContain('+export const a = 2;');
      expect(diff).not.toContain('notes.md');
      await expect(readDiff(repo, 'no-such-branch')).rejects.toThrow(/could not compare/);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
