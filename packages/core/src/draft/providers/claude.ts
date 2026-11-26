import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { ANSWER_SCHEMA } from '../answer.ts';
import { DRAFT_TIMEOUT_MS, type Provider } from './provider.ts';

export const CLAUDE_DEFAULT_MODEL = 'claude-opus-5-5';

/** The part of the SDK client this provider uses; tests pass a fake with the same shape. */
export interface ClaudeClient {
  beta: { messages: { create(params: MessageCreateParamsNonStreaming): Promise<BetaMessage> } };
}

const KEY_HELP = 'Set ANTHROPIC_API_KEY (or sign in with: ant auth login).';

/** Plain words for the SDK's typed errors, most specific first. */
function explain(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError) {
    return new Error(`Claude did not accept the API key. ${KEY_HELP}`, { cause: error });
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new Error('This API key may not use this model.', { cause: error });
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new Error('Claude does not know this model. Check --model.', { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new Error('Claude is rate-limiting this key. Try again in a minute.', { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new Error(
      'Claude did not answer within 3 minutes. Try again, or draft a narrower topic.',
      {
        cause: error,
      },
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new Error('Cannot reach api.anthropic.com. Check the network.', { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    return new Error(`The Claude API answered ${String(error.status)}: ${error.message}`, {
      cause: error,
    });
  }
  // Before any request: for example no key or profile could be found.
  if (error instanceof Error) {
    return new Error(`Claude could not start: ${error.message}. ${KEY_HELP}`, { cause: error });
  }
  return new Error(String(error));
}

function textOf(message: BetaMessage): string {
  return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
}

/**
 * Claude through Anthropic's official SDK. The answer is held to the JSON schema with structured
 * output. Server-side fallback lets another model answer if this one declines the request.
 */
export function claudeProvider({
  model = CLAUDE_DEFAULT_MODEL,
  client,
}: { model?: string; client?: ClaudeClient } = {}): Provider {
  return {
    name: 'claude',
    model,
    callsAModel: true,
    async draft(prompt) {
      let message: BetaMessage;
      try {
        message = await (
          client ?? new Anthropic({ timeout: DRAFT_TIMEOUT_MS, maxRetries: 1 })
        ).beta.messages.create({
          model,
          max_tokens: 16_000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: {
            effort: 'medium',
            format: { type: 'json_schema', schema: ANSWER_SCHEMA },
          },
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        });
      } catch (error) {
        throw explain(error);
      }
      if (message.stop_reason === 'refusal') {
        throw new Error('Claude declined to write these drafts. Try another topic or wording.');
      }
      if (message.stop_reason === 'max_tokens') {
        throw new Error('The answer was cut off at its length limit. Draft a narrower topic.');
      }
      return {
        text: textOf(message),
        model: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      };
    },
  };
}
