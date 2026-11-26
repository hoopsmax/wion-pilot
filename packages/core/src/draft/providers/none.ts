import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Prompt } from '../prompt.ts';

/** The redacted prompt as one text to paste into any chat, with how to bring the answer back. */
export function promptForChat(prompt: Prompt): string {
  return [
    '<!-- Paste everything below into an AI chat. Save its answer to a file, then run:',
    '     npm run wion -- draft --answer <that file>  -->',
    '',
    prompt.system,
    '',
    prompt.user,
    '',
  ].join('\n');
}

/** Saves the chat prompt to .wion/prompts/<time>.md and returns the file's path. */
export async function savePromptForChat(folder: string, text: string, now: Date): Promise<string> {
  await mkdir(folder, { recursive: true });
  const file = join(folder, `${now.toISOString().replace(/[:.]/g, '-')}.md`);
  await writeFile(file, text);
  return file;
}
