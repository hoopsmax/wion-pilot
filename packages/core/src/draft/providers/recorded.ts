import { readFile } from 'node:fs/promises';
import type { Provider } from './provider.ts';

/**
 * Replays a saved answer: an answer pasted from a chat (`--answer`), or a fixed one for tests,
 * CI and demos. No model is called, so nothing is sent anywhere and nothing is billed.
 */
export function recordedProvider(answerFile: string): Provider {
  return {
    name: 'recorded',
    model: 'recorded',
    callsAModel: false,
    async draft() {
      let text: string;
      try {
        text = await readFile(answerFile, 'utf8');
      } catch (error) {
        throw new Error(`Cannot read the answer file ${answerFile}.`, { cause: error });
      }
      return {
        text,
        model: 'recorded',
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    },
  };
}
