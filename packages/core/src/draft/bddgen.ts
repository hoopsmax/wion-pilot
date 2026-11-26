import { execFile, type ExecException } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface BddgenRun {
  exitCode: number;
  output: string;
}

/**
 * The environment without a surrounding test run's state. Inside a Playwright worker,
 * PLAYWRIGHT_BDD_CONFIGS holds the main suite's config, and bddgen would check that suite
 * instead of the draft (and pass a draft with made-up steps).
 */
export function ownEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([name]) => !name.startsWith('PLAYWRIGHT_BDD_') && name !== 'TEST_WORKER_INDEX',
    ),
  );
}

/**
 * Runs playwright-bdd's `bddgen` in draft-check mode: features from `draftFolder`, steps from the
 * shared library only (see WION_DRAFT_CHECK in playwright.config.ts).
 */
export async function runBddgen(
  root: string,
  command: 'test' | 'export',
  draftFolder: string,
): Promise<BddgenRun> {
  const cli = join(root, 'node_modules', 'playwright-bdd', 'dist', 'cli', 'index.js');
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cli, command], {
      cwd: root,
      env: { ...ownEnvironment(), WION_DRAFT_CHECK: draftFolder },
      timeout: 120_000,
    });
    return { exitCode: 0, output: stdout + stderr };
  } catch (error) {
    const failed = error as ExecException & { stdout?: string; stderr?: string };
    // A number is bddgen's own exit code; anything else (not installed, killed) is a real error.
    if (typeof failed.code !== 'number') {
      throw new Error(`Could not run bddgen ${command}. Did npm ci run?`, { cause: error });
    }
    return { exitCode: failed.code, output: `${failed.stdout ?? ''}${failed.stderr ?? ''}` };
  }
}
