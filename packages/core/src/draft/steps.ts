import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBddgen } from './bddgen.ts';

/** The step lines of `bddgen export`, for example "Given {word} is signed in". */
export function parseStepList(output: string): string[] {
  return output
    .split('\n')
    .filter((line) => line.startsWith('* '))
    .map((line) => line.slice(2).trim());
}

/** Every step of the shared library (tests/steps), the only steps a draft may use. */
export async function listSharedSteps(root: string): Promise<string[]> {
  const empty = await mkdtemp(join(tmpdir(), 'wion-steps-'));
  try {
    const { exitCode, output } = await runBddgen(root, 'export', empty);
    if (exitCode !== 0) throw new Error(`bddgen export failed:\n${output}`);
    const steps = parseStepList(output);
    if (steps.length === 0) throw new Error(`bddgen export listed no steps:\n${output}`);
    return steps;
  } finally {
    await rm(empty, { recursive: true, force: true });
  }
}
