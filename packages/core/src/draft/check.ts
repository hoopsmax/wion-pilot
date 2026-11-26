import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBddgen } from './bddgen.ts';

export type CheckResult = { ok: true } | { ok: false; problems: string[] };

/** bddgen lists each missing step as "// Step: When Ava sings to the plant". */
export function missingStepsIn(output: string): string[] {
  return [...output.matchAll(/^\s*\/\/ Step: (.+)$/gm)].map((match) => (match[1] ?? '').trim());
}

/** bddgen's own words for any other failure (a Gherkin syntax error, say), without blank lines. */
function otherProblem(output: string): string {
  return output
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('Using config'))
    .slice(0, 20)
    .join('\n');
}

/**
 * Checks a drafted feature the way the real suite is checked: bddgen must accept it with the
 * shared steps only. It runs in a throwaway folder, so nothing real is touched.
 */
export async function checkDraft(root: string, featureText: string): Promise<CheckResult> {
  const folder = await mkdtemp(join(tmpdir(), 'wion-check-'));
  try {
    await writeFile(join(folder, 'draft.feature'), featureText);
    const { exitCode, output } = await runBddgen(root, 'test', folder);
    if (exitCode === 0) return { ok: true };
    const missing = missingStepsIn(output);
    return {
      ok: false,
      problems:
        missing.length > 0
          ? missing.map((step) => `Unknown step: ${step}`)
          : [otherProblem(output) || `bddgen failed with exit code ${String(exitCode)}.`],
    };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
