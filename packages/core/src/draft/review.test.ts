import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { DraftAnswer } from './answer.ts';
import { toGherkin } from './gherkin.ts';
import { listProposals, saveProposal } from './proposals.ts';
import { applyDecision } from './review.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

const due = {
  name: 'Due today',
  steps: [
    'Given it is "2026-06-15" on Ava\'s device',
    'And a test plant exists',
    'And the test plant is watered every 3 days and was last watered 3 days ago',
    'And Ava is signed in',
    'Then Ava sees the test plant marked "Water today"',
  ],
};
const invented = { name: 'Singing', steps: ['Given Ava is signed in', 'When Ava sings to it'] };
const answer: DraftAnswer = {
  feature: 'more-reminders',
  title: 'More reminders',
  description: '',
  changeSummary: '',
  testPlan: [],
  scenarios: [due],
  missingSteps: [],
};

let folder: string;
let places: { root: string; proposalsDir: string; featuresDir: string; today: string };

async function proposal(scenarios = answer.scenarios) {
  const draft = { ...answer, scenarios };
  const origin = { provider: 'recorded', model: 'recorded', date: '2026-11-26' };
  await saveProposal(places.proposalsDir, toGherkin(draft, origin), {
    feature: draft.feature,
    title: draft.title,
    provider: 'recorded',
    model: 'recorded',
    topic: 'reminders',
    diffBase: undefined,
    createdAt: '2026-11-26T10:00:00.000Z',
    check: { ok: true },
    answer: draft,
  });
  const [saved] = await listProposals(places.proposalsDir);
  if (!saved) throw new Error('The proposal was not saved.');
  return saved;
}

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'wion-review-'));
  places = {
    root: repoRoot,
    proposalsDir: join(folder, 'proposals'),
    featuresDir: join(folder, 'features'),
    today: '2026-11-27',
  };
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe('applyDecision', () => {
  test('approved scenarios are added to the end of an existing feature, which stays as it was', async () => {
    const target = join(places.featuresDir, 'more-reminders', 'more-reminders.feature');
    await mkdir(join(places.featuresDir, 'more-reminders'), { recursive: true });
    await writeFile(
      target,
      'Feature: More reminders\n\n  Scenario: Hand-written\n    Given Ava is signed in\n',
    );
    await applyDecision(await proposal(), { approved: [due], rejected: [] }, places);
    const text = await readFile(target, 'utf8');
    expect(text.startsWith('Feature: More reminders\n\n  Scenario: Hand-written\n')).toBe(true);
    expect(text).toContain(
      '  # Drafted by recorded/recorded on 2026-11-26, approved with wion review on 2026-11-27.\n  Scenario: Due today',
    );
  }, 60_000);

  test('nothing approved: nothing written, and the proposal is archived with the decision', async () => {
    expect(
      await applyDecision(await proposal(), { approved: [], rejected: [due] }, places),
    ).toBeUndefined();
    expect(await listProposals(places.proposalsDir)).toEqual([]);
    const archived = await readdir(join(places.proposalsDir, 'reviewed'));
    const record = archived.find((name) => name.endsWith('.json')) ?? '';
    const json = JSON.parse(
      await readFile(join(places.proposalsDir, 'reviewed', record), 'utf8'),
    ) as {
      rejected: string[];
    };
    expect(json.rejected).toEqual(['Due today']);
  });

  test('an approved scenario that fails the check is not written', async () => {
    await expect(
      applyDecision(
        await proposal([due, invented]),
        { approved: [invented], rejected: [] },
        places,
      ),
    ).rejects.toThrow(
      /fail the check, so nothing was written:\nUnknown step: When Ava sings to it/,
    );
    expect(await listProposals(places.proposalsDir)).toHaveLength(1);
  }, 60_000);
});
