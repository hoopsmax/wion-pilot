import { describe, expect, test } from 'vitest';
import type { BddStep } from './feature-lines.ts';
import { recordedGherkinSteps, stepStatuses, type StepTree } from './step-status.ts';

const gherkin = (texts: string[]): BddStep[] =>
  texts.map((textWithKeyword, i) => ({
    pwStepLine: 10 + i,
    gherkinStepLine: 5 + i,
    textWithKeyword,
  }));

describe('recordedGherkinSteps', () => {
  const tree = (
    title: string,
    category: string,
    steps: StepTree[] = [],
    error?: unknown,
  ): StepTree => ({
    title,
    category,
    steps,
    ...(error === undefined ? {} : { error }),
  });

  test('finds Background steps inside the before hook, in order, and not the actions inside steps', () => {
    const recorded: StepTree[] = [
      tree('Before Hooks', 'hook', [
        tree('Fixture "people"', 'fixture'),
        tree('Given a test plant exists', 'test.step'),
      ]),
      tree('When Ava saves', 'test.step', [tree('Click', 'pw:api')]),
      tree('Then it is saved', 'test.step', [], new Error('no')),
    ];
    expect(recordedGherkinSteps(recorded)).toEqual([
      { title: 'Given a test plant exists', failed: false },
      { title: 'When Ava saves', failed: false },
      { title: 'Then it is saved', failed: true },
    ]);
  });
});

describe('stepStatuses', () => {
  test('marks passed, failed and not run steps with their .feature lines', () => {
    const steps = gherkin([
      'Given Ava is signed in',
      'When Ava signs out',
      'Then Ava sees the sign-in screen',
    ]);
    const recorded = [
      { title: 'Given Ava is signed in', failed: false },
      { title: 'When Ava signs out', failed: true },
    ];
    expect(stepStatuses(steps, recorded)).toEqual([
      { text: 'Given Ava is signed in', status: 'passed', featureLine: 5 },
      { text: 'When Ava signs out', status: 'failed', featureLine: 6 },
      { text: 'Then Ava sees the sign-in screen', status: 'not run', featureLine: 7 },
    ]);
  });

  test('the same step text twice is matched in order', () => {
    const steps = gherkin(['And Ava saves the form', 'And Ava saves the form']);
    const recorded = [
      { title: 'And Ava saves the form', failed: false },
      { title: 'And Ava saves the form', failed: true },
    ];
    expect(stepStatuses(steps, recorded).map((step) => step.status)).toEqual(['passed', 'failed']);
  });

  test('ignores recorded steps that are not Gherkin steps, such as fixtures', () => {
    const steps = gherkin(['When Ava signs in']);
    const recorded = [
      { title: 'Fixture "people"', failed: false },
      { title: 'When Ava signs in', failed: false },
    ];
    expect(stepStatuses(steps, recorded)[0]?.status).toBe('passed');
  });
});
