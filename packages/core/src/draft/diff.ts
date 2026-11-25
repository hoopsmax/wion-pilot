import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** About 15,000 tokens: enough for a feature-sized change, and a clear stop for anything bigger. */
export const MAX_DIFF_CHARS = 60_000;

/** Only the app's own code: tests, docs and tooling say nothing about what a user can do. */
export const DIFF_PATHS = ['apps/'];

/** A diff too big for one request is refused as a whole; cutting it would hide part of the change. */
export function checkDiffSize(diff: string, base: string, max = MAX_DIFF_CHARS): string {
  if (diff.trim() === '') {
    throw new Error(`There is no change in ${DIFF_PATHS.join(', ')} since ${base}.`);
  }
  if (diff.length > max) {
    throw new Error(
      `The change since ${base} is ${String(diff.length)} characters, over the limit of ` +
        `${String(max)}. Draft from a closer base (for example the previous commit) or by topic.`,
    );
  }
  return diff;
}

/** The code change since `base` (a branch, tag or commit), app code only. */
export async function readDiff(root: string, base: string, max = MAX_DIFF_CHARS): Promise<string> {
  let diff: string;
  try {
    ({ stdout: diff } = await execFileAsync(
      'git',
      ['diff', '--no-color', '--no-ext-diff', base, '--', ...DIFF_PATHS],
      { cwd: root, maxBuffer: 20 * 1024 * 1024 },
    ));
  } catch (error) {
    throw new Error(`git could not compare with "${base}". Is it a branch, tag or commit?`, {
      cause: error,
    });
  }
  return checkDiffSize(diff, base, max);
}
