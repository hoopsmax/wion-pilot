import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseAnswerText, type DraftAnswer } from '../../core/src/draft/answer.ts';
import { checkDraft } from '../../core/src/draft/check.ts';
import { readExampleFeatures } from '../../core/src/draft/examples.ts';
import { readDiff } from '../../core/src/draft/diff.ts';
import { toGherkin } from '../../core/src/draft/gherkin.ts';
import { appendToLedger, ledgerEntry } from '../../core/src/draft/ledger.ts';
import { buildPrompt, redactPrompt, type Prompt } from '../../core/src/draft/prompt.ts';
import { saveProposal } from '../../core/src/draft/proposals.ts';
import { CLAUDE_DEFAULT_MODEL, claudeProvider } from '../../core/src/draft/providers/claude.ts';
import { promptForChat, savePromptForChat } from '../../core/src/draft/providers/none.ts';
import { ollamaProvider } from '../../core/src/draft/providers/ollama.ts';
import type { Provider } from '../../core/src/draft/providers/provider.ts';
import { recordedProvider } from '../../core/src/draft/providers/recorded.ts';
import type { Replaced } from '../../core/src/draft/redact.ts';
import { listSharedSteps } from '../../core/src/draft/steps.ts';
import type { AppMap } from '../../core/src/map/app-map.ts';
import type { Environment } from '../../core/src/shared/config.ts';
import type { DraftArgs } from './args.ts';

/** wion's own files, inside --wion-dir (default .wion, which git ignores). */
export function wionPaths(root: string, wionDir: string) {
  const base = resolve(root, wionDir);
  return {
    map: join(base, 'map', 'app-map.json'),
    proposals: join(base, 'proposals'),
    prompts: join(base, 'prompts'),
    ledger: join(base, 'ledger.jsonl'),
  };
}

export const OLLAMA_DEFAULT_MODEL = 'llama3.1';

export interface DraftIo {
  root: string;
  env: Environment;
  now: () => Date;
  log: (line: string) => void;
}

/** Drafts still work without a map; they are better with one, so the user is told how to get it. */
async function readMapIfAny(file: string, log: (line: string) => void): Promise<AppMap> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as AppMap;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    log(`No app map at ${file}: drafting without screens. For better drafts: npm run map:sprout`);
    return { startUrl: '', createdAt: '', screens: [], skipped: [] };
  }
}

function describeRedaction({ emails, secrets }: Replaced): string {
  if (emails + secrets === 0) return 'Nothing personal or secret found in the prompt.';
  return `Removed from the prompt: ${String(emails)} email(s), ${String(secrets)} secret(s).`;
}

async function redactedPrompt(args: DraftArgs, io: DraftIo): Promise<Prompt> {
  const [steps, map, examples, diff] = await Promise.all([
    listSharedSteps(io.root),
    readMapIfAny(wionPaths(io.root, args.wionDir).map, io.log),
    readExampleFeatures(io.root),
    args.diffBase === undefined ? undefined : readDiff(io.root, args.diffBase),
  ]);
  const { prompt, replaced } = redactPrompt(
    buildPrompt({ topic: args.topic, diff, map, steps, examples }),
    io.env,
  );
  io.log(describeRedaction(replaced));
  return prompt;
}

function providerFor(args: DraftArgs): Provider {
  if (args.answerFile !== undefined) return recordedProvider(args.answerFile);
  if (args.provider === 'claude') {
    return claudeProvider({ model: args.model ?? CLAUDE_DEFAULT_MODEL });
  }
  return ollamaProvider({ model: args.model ?? OLLAMA_DEFAULT_MODEL });
}

/** Calls the provider; a real call goes into the ledger before its answer is even looked at. */
async function callProvider(provider: Provider, prompt: Prompt, ledger: string, io: DraftIo) {
  const started = io.now();
  const seconds = () => (io.now().getTime() - started.getTime()) / 1000;
  if (provider.callsAModel) {
    io.log(
      `Asking ${provider.name}/${provider.model} for drafts. This usually takes under a minute…`,
    );
  }
  let reply;
  try {
    reply = await provider.draft(prompt);
  } catch (error) {
    // A failed call is still a call: it goes into the ledger too.
    if (provider.callsAModel) {
      await appendToLedger(
        ledger,
        ledgerEntry({
          time: started,
          command: 'draft',
          provider: provider.name,
          model: provider.model,
          usage: { inputTokens: 0, outputTokens: 0 },
          seconds: seconds(),
          failed: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    throw error;
  }
  if (provider.callsAModel) {
    const entry = ledgerEntry({
      time: started,
      command: 'draft',
      provider: provider.name,
      model: reply.model,
      usage: reply.usage,
      seconds: seconds(),
    });
    await appendToLedger(ledger, entry);
    const cost =
      entry.estimatedCostUsd === null
        ? 'cost unknown'
        : `about $${entry.estimatedCostUsd.toFixed(2)}`;
    io.log(
      `${provider.name}/${reply.model}: ${entry.inputTokens.toLocaleString('en')} in / ` +
        `${entry.outputTokens.toLocaleString('en')} out tokens, ${String(entry.seconds)} s, ${cost}.`,
    );
  }
  return reply;
}

function logAnswer(answer: DraftAnswer, log: (line: string) => void): void {
  log(`Scenarios (${String(answer.scenarios.length)}):`);
  for (const scenario of answer.scenarios) log(`  - ${scenario.name}`);
  if (answer.missingSteps.length > 0) {
    log('Missing steps (not used; a person writes them first):');
    for (const missing of answer.missingSteps) log(`  - "${missing.phrase}": ${missing.purpose}`);
  }
}

/** Returns the exit code: 0 for a proposal that passed the check, 1 for one that did not. */
export async function runDraft(args: DraftArgs, io: DraftIo): Promise<number> {
  const paths = wionPaths(io.root, args.wionDir);
  const prompt = args.answerFile === undefined ? await redactedPrompt(args, io) : undefined;
  if (prompt && args.provider === 'none') {
    const file = await savePromptForChat(paths.prompts, promptForChat(prompt), io.now());
    io.log(`No AI was called (provider: none). The prompt is in ${file}.`);
    io.log('Paste it into any AI chat, save the answer to a file, then run:');
    io.log('  npm run wion -- draft --answer <that file>');
    return 0;
  }
  const provider = providerFor(args);
  const reply = await callProvider(provider, prompt ?? { system: '', user: '' }, paths.ledger, io);
  const answer = parseAnswerText(reply.text);
  const now = io.now();
  const origin = {
    provider: provider.name,
    model: reply.model,
    date: now.toISOString().slice(0, 10),
  };
  const featureText = toGherkin(answer, origin);
  const check = await checkDraft(io.root, featureText);
  const saved = await saveProposal(paths.proposals, featureText, {
    feature: answer.feature,
    title: answer.title,
    provider: provider.name,
    model: reply.model,
    topic: args.topic,
    diffBase: args.diffBase,
    createdAt: now.toISOString(),
    check,
    answer,
  });
  logAnswer(answer, io.log);
  io.log(`Proposal: ${saved.featureFile}${saved.replaced ? ' (replaces the earlier draft)' : ''}`);
  if (!check.ok) {
    io.log('It FAILED the check, so review will not offer it:');
    for (const problem of check.problems) io.log(`  ${problem}`);
    return 1;
  }
  io.log('It passed the check. Next: npm run wion -- review');
  return 0;
}
