import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJsonFile(path: string): Promise<unknown> {
  const text = await readFile(path, 'utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Sprout data file ${path} is not valid JSON. Run npm run demo:reset.`, {
      cause: error,
    });
  }
}

/**
 * Writes to a temporary file first and then renames it over the old one.
 * A rename is atomic, so a reader never sees a half-written file.
 */
export async function writeJsonFileAtomic(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${String(process.pid)}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await rename(temporaryPath, path);
}
