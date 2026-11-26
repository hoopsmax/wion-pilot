import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { DraftAnswer } from './answer.ts';
import { checkDraft, missingStepsIn } from './check.ts';
import { toGherkin } from './gherkin.ts';
import { listProposals, saveProposal, type ProposalMeta } from './proposals.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');
const origin = { provider: 'recorded', model: 'test', date: '2026-11-26' };

const answer: DraftAnswer = {
  feature: 'watering-reminders',
  title: 'Watering reminders',
  description: 'Each plant says when to water it.\nScenario: lines like this must not break it',
  changeSummary: 'Plants now remember their last watering.',
  testPlan: ['Each wording', 'Given an offline device, the watering waits'],
  scenarios: [
    {
      name: 'A plant due today',
      steps: [
        'Given it is "2026-06-15" on Ava\'s device',
        'And a test plant exists',
        'And the test plant is watered every 3 days and was last watered 3 days ago',
        'And Ava is signed in',
        'Then Ava sees the test plant marked "Water today"',
      ],
    },
  ],
  missingSteps: [{ phrase: 'Ava sorts the list by due date', purpose: 'No sorting yet.' }],
};

describe('toGherkin', () => {
  test('a fixed layout: header, missing steps as comments, tag, description, plan, scenarios', () => {
    expect(toGherkin(answer, origin)).toBe(
      [
        '# Drafted by recorded/test on 2026-11-26. Not approved yet.',
        '# Missing steps (not used below; a person writes them first):',
        '#   - "Ava sorts the list by due date": No sorting yet.',
        '@ai-drafted',
        'Feature: Watering reminders',
        '  Each plant says when to water it.',
        '  Note: Scenario: lines like this must not break it',
        '',
        '  What changed: Plants now remember their last watering.',
        '',
        '  Test plan:',
        '  - Each wording',
        '  - Given an offline device, the watering waits',
        '',
        '  Scenario: A plant due today',
        '    Given it is "2026-06-15" on Ava\'s device',
        '    And a test plant exists',
        '    And the test plant is watered every 3 days and was last watered 3 days ago',
        '    And Ava is signed in',
        '    Then Ava sees the test plant marked "Water today"',
        '',
      ].join('\n'),
    );
  });
});

describe('missingStepsIn', () => {
  test('reads the missing steps from bddgen output', () => {
    const output =
      "Missing step definitions: 1\n\nWhen('x', async ({}) => {\n  // Step: When Ava sings\n";
    expect(missingStepsIn(output)).toEqual(['When Ava sings']);
  });
});

// These run the real bddgen against the real shared steps, as wion draft does.
describe('checkDraft', () => {
  test('a draft using only shared steps passes', async () => {
    expect(await checkDraft(repoRoot, toGherkin(answer, origin))).toEqual({ ok: true });
  }, 60_000);

  test('a made-up step fails, and the problem names it', async () => {
    const invented = {
      ...answer,
      scenarios: [{ name: 'Singing', steps: ['Given Ava is signed in', 'When Ava sings to it'] }],
    };
    expect(await checkDraft(repoRoot, toGherkin(invented, origin))).toEqual({
      ok: false,
      problems: ['Unknown step: When Ava sings to it'],
    });
  }, 60_000);

  test('a step of a single feature (not the shared library) is not allowed either', async () => {
    const featureOnly = {
      ...answer,
      scenarios: [{ name: 'Mapping', steps: ['When Sprout is mapped'] }],
    };
    expect(await checkDraft(repoRoot, toGherkin(featureOnly, origin))).toEqual({
      ok: false,
      problems: ['Unknown step: When Sprout is mapped'],
    });
  }, 60_000);
});

describe('proposals', () => {
  test('saved next to their details, listed oldest first, a newer draft replaces an older', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'wion-proposals-'));
    const meta: ProposalMeta = {
      feature: 'watering-reminders',
      title: 'Watering reminders',
      provider: 'recorded',
      model: 'test',
      topic: 'watering reminders',
      diffBase: undefined,
      createdAt: '2026-11-26T10:00:00.000Z',
      check: { ok: true },
      missingSteps: [],
    };
    try {
      expect(await listProposals(join(folder, 'none-yet'))).toEqual([]);
      const first = await saveProposal(folder, 'Feature: A\n', meta);
      await saveProposal(folder, 'Feature: B\n', {
        ...meta,
        feature: 'other',
        createdAt: '2026-11-26T09:00:00.000Z',
      });
      const second = await saveProposal(folder, 'Feature: A2\n', meta);
      expect([first.replaced, second.replaced]).toEqual([false, true]);
      const listed = await listProposals(folder);
      expect(listed.map((p) => [p.meta.feature, p.featureText])).toEqual([
        ['other', 'Feature: B\n'],
        ['watering-reminders', 'Feature: A2\n'],
      ]);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
