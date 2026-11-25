import { execFile, type ExecException } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AppMap } from '../../packages/core/src/map/app-map.ts';

const repoRoot = join(import.meta.dirname, '..', '..');
const cli = join(repoRoot, 'packages', 'cli', 'src', 'main.ts');
const execFileAsync = promisify(execFile);

/** What one run of `wion map` left behind. */
export interface MapRun {
  exitCode: number;
  /** Everything it printed, for checks and for the failure message. */
  output: string;
  outDir: string;
  /** The map it wrote; undefined when the run failed. */
  map: AppMap | undefined;
}

/**
 * Runs the real command, the way a person does, with the sign-in from wion.config.json and the
 * password in SPROUT_PASSWORD. Each test passes its own output folder, so runs never collide.
 */
export async function runWionMap({
  url,
  outDir,
  password,
}: {
  url: string;
  outDir: string;
  password: string;
}): Promise<MapRun> {
  let exitCode = 0;
  let output: string;
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cli, 'map', url, '--out', outDir],
      { cwd: repoRoot, env: { ...process.env, SPROUT_PASSWORD: password }, timeout: 120_000 },
    );
    output = stdout + stderr;
  } catch (error) {
    const failed = error as ExecException & { stdout?: string; stderr?: string };
    // A number is the command's own exit code; anything else (not started, killed) is a real error.
    if (typeof failed.code !== 'number') throw error;
    exitCode = failed.code;
    output = `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
  }
  const map =
    exitCode === 0
      ? (JSON.parse(await readFile(join(outDir, 'app-map.json'), 'utf8')) as AppMap)
      : undefined;
  return { exitCode, output, outDir, map };
}

/** A port nothing listens on: the system hands out a free one, and it is closed again at once. */
export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  if (address === null || typeof address === 'string') {
    throw new Error('The system did not give a port number.');
  }
  return address.port;
}
