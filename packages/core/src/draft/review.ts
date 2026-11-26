import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DraftScenario } from './answer.ts';
import { checkDraft } from './check.ts';
import { approvedHeader, scenarioLines, toGherkin } from './gherkin.ts';
import type { Proposal } from './proposals.ts';

export interface Decision {
  approved: DraftScenario[];
  rejected: DraftScenario[];
}

export interface ReviewPlaces {
  root: string;
  proposalsDir: string;
  featuresDir: string;
  /** YYYY-MM-DD */
  today: string;
}

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** The approved scenarios as a feature of their own: what is checked before anything is written. */
function approvedFeature(proposal: Proposal, approved: DraftScenario[], today: string): string {
  const { meta } = proposal;
  const origin = { provider: meta.provider, model: meta.model, date: meta.createdAt.slice(0, 10) };
  return toGherkin({ ...meta.answer, scenarios: approved }, origin, approvedHeader(origin, today));
}

/** Existing scenarios stay as they are; the approved ones go at the end, under a note. */
function appendTo(existing: string, proposal: Proposal, approved: DraftScenario[], today: string) {
  const { meta } = proposal;
  const origin = { provider: meta.provider, model: meta.model, date: meta.createdAt.slice(0, 10) };
  return `${existing.trimEnd()}\n\n  ${approvedHeader(origin, today)}${scenarioLines(approved).join('\n')}\n`;
}

/** Moves the proposal out of the queue, with what was decided, so it is never offered again. */
async function archive(
  proposal: Proposal,
  decision: Decision,
  places: ReviewPlaces,
): Promise<void> {
  const { feature, createdAt } = proposal.meta;
  const reviewed = join(places.proposalsDir, 'reviewed');
  await mkdir(reviewed, { recursive: true });
  const stamp = `${createdAt.replace(/[:.]/g, '-')}-${feature}`;
  await rename(join(places.proposalsDir, `${feature}.feature`), join(reviewed, `${stamp}.feature`));
  const record = {
    ...proposal.meta,
    reviewedOn: places.today,
    approved: decision.approved.map((scenario) => scenario.name),
    rejected: decision.rejected.map((scenario) => scenario.name),
  };
  await writeFile(join(reviewed, `${stamp}.json`), `${JSON.stringify(record, null, 2)}\n`);
  await rm(join(places.proposalsDir, `${feature}.json`));
}

/**
 * Applies a person's decision: approved scenarios are checked with bddgen first, then written into
 * tests/features (a new file, or added to the end of an existing one; nothing is overwritten).
 * Returns the file written, or undefined when nothing was approved.
 */
export async function applyDecision(
  proposal: Proposal,
  decision: Decision,
  places: ReviewPlaces,
): Promise<string | undefined> {
  let written: string | undefined;
  if (decision.approved.length > 0) {
    const check = await checkDraft(
      places.root,
      approvedFeature(proposal, decision.approved, places.today),
    );
    if (!check.ok) {
      throw new Error(
        `The approved scenarios fail the check, so nothing was written:\n${check.problems.join('\n')}`,
      );
    }
    const { feature } = proposal.meta;
    const folder = join(places.featuresDir, feature);
    written = join(folder, `${feature}.feature`);
    const existing = await readIfExists(written);
    await mkdir(folder, { recursive: true });
    await writeFile(
      written,
      existing === undefined
        ? approvedFeature(proposal, decision.approved, places.today)
        : appendTo(existing, proposal, decision.approved, places.today),
    );
  }
  if (await exists(join(places.proposalsDir, `${proposal.meta.feature}.json`))) {
    await archive(proposal, decision, places);
  }
  return written;
}
