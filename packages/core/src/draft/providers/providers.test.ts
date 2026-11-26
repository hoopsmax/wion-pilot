import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { describe, expect, test } from 'vitest';
import { ANSWER_SCHEMA, type DraftAnswer } from '../answer.ts';
import { claudeProvider, type ClaudeClient } from './claude.ts';
import { promptForChat, savePromptForChat } from './none.ts';
import { ollamaProvider } from './ollama.ts';
import { recordedProvider } from './recorded.ts';

const prompt = { system: 'RULES', user: 'WHAT TO TEST' };
const answer: DraftAnswer = {
  feature: 'watering-reminders',
  title: 'Watering reminders',
  description: '',
  changeSummary: '',
  testPlan: [],
  scenarios: [{ name: 'Due today', steps: ['Given Ava is signed in'] }],
  missingSteps: [],
};

/** A fake SDK client: records the request and answers with `reply`, or throws `failure`. */
function fakeClaude(reply: Partial<BetaMessage>, failure?: Error) {
  const sent: MessageCreateParamsNonStreaming[] = [];
  const client: ClaudeClient = {
    beta: {
      messages: {
        create(params) {
          sent.push(params);
          if (failure instanceof Error) return Promise.reject(failure);
          return Promise.resolve({
            model: 'claude-opus-5-5',
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: JSON.stringify(answer) }],
            usage: { input_tokens: 1200, output_tokens: 300 },
            ...reply,
          } as unknown as BetaMessage);
        },
      },
    },
  };
  return { client, sent };
}

describe('claude', () => {
  test('asks for structured output with the answer schema, medium effort and fallback', async () => {
    const { client, sent } = fakeClaude({});
    const reply = await claudeProvider({ client }).draft(prompt);
    expect(sent[0]).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
      system: 'RULES',
      messages: [{ role: 'user', content: 'WHAT TO TEST' }],
    });
    expect(reply).toEqual({
      text: JSON.stringify(answer),
      model: 'claude-opus-5-5',
      usage: { inputTokens: 1200, outputTokens: 300 },
    });
  });

  test('records the model that really answered, after a fallback', async () => {
    const { client } = fakeClaude({ model: 'claude-opus-5' });
    expect((await claudeProvider({ client }).draft(prompt)).model).toBe('claude-opus-5');
  });

  test.each([
    ['refusal', /declined to write these drafts/],
    ['max_tokens', /cut off at its length limit/],
  ] as const)('stop reason %s is explained', async (stopReason, message) => {
    const { client } = fakeClaude({ stop_reason: stopReason });
    await expect(claudeProvider({ client }).draft(prompt)).rejects.toThrow(message);
  });

  test('a rate limit and a missing key get plain explanations', async () => {
    const limited = Object.create(Anthropic.RateLimitError.prototype) as Error;
    await expect(
      claudeProvider({ client: fakeClaude({}, limited).client }).draft(prompt),
    ).rejects.toThrow(/rate-limiting this key/);
    const noKey = new Error('Could not resolve authentication method');
    await expect(
      claudeProvider({ client: fakeClaude({}, noKey).client }).draft(prompt),
    ).rejects.toThrow(/Claude could not start: .*Set ANTHROPIC_API_KEY/);
  });
});

describe('ollama', () => {
  test('sends the schema as format and reads the answer and token counts', async () => {
    let body: Record<string, unknown> = {};
    const fetchFn = ((_url: string, init: RequestInit) => {
      // wion sends the body as a JSON string.
      body = JSON.parse(init.body as string) as Record<string, unknown>;
      return Promise.resolve(
        Response.json({
          model: 'llama3.1',
          message: { content: JSON.stringify(answer) },
          prompt_eval_count: 900,
          eval_count: 250,
        }),
      );
    }) as typeof fetch;
    const reply = await ollamaProvider({ model: 'llama3.1', fetchFn }).draft(prompt);
    expect(body).toMatchObject({ model: 'llama3.1', stream: false, format: ANSWER_SCHEMA });
    expect(reply).toEqual({
      text: JSON.stringify(answer),
      model: 'llama3.1',
      usage: { inputTokens: 900, outputTokens: 250 },
    });
  });

  test('not running, or the model not pulled, is explained', async () => {
    const down = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    await expect(ollamaProvider({ model: 'x', fetchFn: down }).draft(prompt)).rejects.toThrow(
      /not answering at http:\/\/localhost:11434.*ollama serve/,
    );
    const missing = (() =>
      Promise.resolve(
        Response.json({ error: 'model "x" not found' }, { status: 404 }),
      )) as typeof fetch;
    await expect(ollamaProvider({ model: 'x', fetchFn: missing }).draft(prompt)).rejects.toThrow(
      /404: model "x" not found\. Get the model with: ollama pull x/,
    );
  });
});

describe('recorded and none', () => {
  test('recorded replays a pasted answer and calls no model', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'wion-recorded-'));
    try {
      const file = join(folder, 'answer.md');
      await writeFile(file, `Sure!\n\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``);
      const provider = recordedProvider(file);
      expect(provider.callsAModel).toBe(false);
      expect((await provider.draft(prompt)).text).toContain(JSON.stringify(answer));
      await expect(recordedProvider(join(folder, 'missing')).draft(prompt)).rejects.toThrow(
        /Cannot read the answer file/,
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  test('none saves the prompt for a chat, with how to bring the answer back', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'wion-none-'));
    try {
      const text = promptForChat(prompt);
      const file = await savePromptForChat(folder, text, new Date('2026-11-26T10:00:00.000Z'));
      expect(file).toBe(join(folder, '2026-11-26T10-00-00-000Z.md'));
      const saved = await readFile(file, 'utf8');
      expect(saved).toContain('npm run wion -- draft --answer <that file>');
      expect(saved).toContain('RULES\n\nWHAT TO TEST');
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
