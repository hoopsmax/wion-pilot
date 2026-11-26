import { ANSWER_SCHEMA } from '../answer.ts';
import type { Provider } from './provider.ts';

export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';

interface OllamaChatReply {
  model?: string;
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

/**
 * A local model through Ollama's HTTP API: nothing leaves the computer and nothing is billed.
 * `format` holds the model to the answer's JSON schema.
 */
export function ollamaProvider({
  model,
  baseUrl = OLLAMA_DEFAULT_URL,
  fetchFn = fetch,
}: {
  model: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}): Provider {
  return {
    name: 'ollama',
    callsAModel: true,
    async draft(prompt) {
      let response: Response;
      try {
        response = await fetchFn(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            stream: false,
            format: ANSWER_SCHEMA,
            // Drafts should be steady, not creative.
            options: { temperature: 0 },
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
          }),
        });
      } catch (error) {
        throw new Error(
          `Ollama is not answering at ${baseUrl}. Is it running? Start it with: ollama serve`,
          {
            cause: error,
          },
        );
      }
      const reply = (await response.json()) as OllamaChatReply;
      if (!response.ok) {
        const pull = response.status === 404 ? ` Get the model with: ollama pull ${model}` : '';
        throw new Error(
          `Ollama answered ${String(response.status)}: ${reply.error ?? 'no details'}.${pull}`,
        );
      }
      return {
        text: reply.message?.content ?? '',
        model: reply.model ?? model,
        usage: { inputTokens: reply.prompt_eval_count ?? 0, outputTokens: reply.eval_count ?? 0 },
      };
    },
  };
}
