import { relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import type { DraftScenario } from '../../core/src/draft/answer.ts';
import { listProposals, type Proposal } from '../../core/src/draft/proposals.ts';
import { applyDecision, type Decision } from '../../core/src/draft/review.ts';
import type { ReviewArgs } from './args.ts';
import { wionPaths } from './draft-command.ts';

export interface ReviewIo {
  root: string;
  now: () => Date;
  log: (line: string) => void;
  /** Asks a question; undefined when the input has ended. */
  ask: (question: string) => Promise<string | undefined>;
}

type Answer = 'yes' | 'no' | 'skip' | 'quit';

/** A path inside the project is shown relative to it; anything else in full. */
function shownPath(root: string, path: string): string {
  const inside = relative(root, path);
  return inside.startsWith('..') ? path : inside;
}

const CHOICES: Record<string, Answer> = { y: 'yes', n: 'no', s: 'skip', q: 'quit' };

/** Only the first letter counts, so "y", "Y", "yes" and "[y]" all mean yes. */
export function readAnswer(reply: string): Answer | 'empty' | 'unknown' {
  const letter = reply
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 1);
  if (letter === '') return 'empty';
  return CHOICES[letter] ?? 'unknown';
}

async function askFor(scenario: DraftScenario, io: ReviewIo): Promise<Answer> {
  io.log('');
  io.log(`  Scenario: ${scenario.name}`);
  for (const step of scenario.steps) io.log(`    ${step}`);
  for (;;) {
    const reply = await io.ask('Approve? [y]es, [n]o, [s]kip this proposal, [q]uit: ');
    // The input ended (Ctrl+D, or a pipe ran dry): stop without deciding anything more.
    if (reply === undefined) return 'quit';
    const answer = readAnswer(reply);
    // An empty line (an extra Enter) simply asks again.
    if (answer === 'empty') continue;
    if (answer !== 'unknown') return answer;
    io.log('Please answer y, n, s or q.');
  }
}

function introduce(proposal: Proposal, io: ReviewIo): void {
  const { meta } = proposal;
  io.log('');
  io.log(`== ${meta.title} (${meta.feature}), drafted by ${meta.provider}/${meta.model}`);
  if (meta.topic) io.log(`   Topic: ${meta.topic}`);
  if (meta.diffBase) io.log(`   From the code change since: ${meta.diffBase}`);
  if (meta.answer.changeSummary) io.log(`   What changed: ${meta.answer.changeSummary}`);
  for (const item of meta.answer.testPlan) io.log(`   Plan: ${item}`);
  for (const missing of meta.answer.missingSteps) {
    io.log(`   Missing step (not used): "${missing.phrase}": ${missing.purpose}`);
  }
}

/** Goes through the proposals one scenario at a time. Returns the exit code. */
export async function runReview(args: ReviewArgs, io: ReviewIo): Promise<number> {
  const proposalsDir = wionPaths(io.root, args.wionDir).proposals;
  const proposals = await listProposals(proposalsDir);
  if (proposals.length === 0) {
    io.log('No proposals to review. Draft some with: npm run wion -- draft "<topic>"');
    return 0;
  }
  const places = {
    root: io.root,
    proposalsDir,
    featuresDir: resolve(io.root, args.featuresDir),
    today: io.now().toISOString().slice(0, 10),
  };
  for (const proposal of proposals) {
    const { meta } = proposal;
    if (!meta.check.ok) {
      io.log(`Not offered: ${meta.feature} failed the check (${meta.check.problems.join('; ')}).`);
      io.log('  Draft it again, or fix the steps it needs.');
      continue;
    }
    introduce(proposal, io);
    const decision: Decision = { approved: [], rejected: [] };
    let next: Answer = 'yes';
    for (const scenario of meta.answer.scenarios) {
      next = await askFor(scenario, io);
      if (next === 'yes') decision.approved.push(scenario);
      else if (next === 'no') decision.rejected.push(scenario);
      else break;
    }
    if (next === 'quit') {
      io.log('Stopped. This proposal stays as it was.');
      return 0;
    }
    if (next === 'skip') {
      io.log('Skipped. This proposal stays for later.');
      continue;
    }
    const written = await applyDecision(proposal, decision, places);
    if (written) {
      io.log(
        `Wrote ${String(decision.approved.length)} approved scenario(s) to ${shownPath(io.root, written)}.`,
      );
      io.log(`Run them: npm test -- --grep "${meta.title}"`);
    } else {
      io.log('Nothing approved, nothing written.');
    }
  }
  return 0;
}

/** Review in a terminal (or with answers piped in): lines are read in order, none are lost. */
export async function runReviewInTerminal(
  args: ReviewArgs,
  io: Omit<ReviewIo, 'ask'>,
): Promise<number> {
  const input = createInterface({ input: process.stdin, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  try {
    return await runReview(args, {
      ...io,
      async ask(question) {
        process.stdout.write(question);
        const { value, done } = await lines.next();
        return done ? undefined : value;
      },
    });
  } finally {
    // Stopping the line reader is not enough: the interface keeps reading the terminal, and wion
    // would never return to the shell. Closing it releases the input.
    input.close();
  }
}
