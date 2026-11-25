import type { DraftStep } from './draft.ts';
import type { BddStep } from './feature-lines.ts';

/** A step as Playwright recorded it while the test ran. */
export interface RecordedStep {
  title: string;
  failed: boolean;
}

/** The part of a Playwright test step this module needs (keeps it testable without Playwright). */
export interface StepTree {
  title: string;
  category: string;
  error?: unknown;
  steps: StepTree[];
}

/**
 * The Gherkin steps Playwright recorded, in order. Background steps run inside a "before" hook,
 * so the search goes into hooks too; inside a Gherkin step it stops (those are its own actions).
 */
export function recordedGherkinSteps(steps: StepTree[]): RecordedStep[] {
  return steps.flatMap((step) =>
    step.category === 'test.step'
      ? [{ title: step.title, failed: step.error !== undefined }]
      : recordedGherkinSteps(step.steps),
  );
}

/**
 * Marks every Gherkin step of a scenario: "failed" if it ran and failed, "passed" if it ran,
 * "not run" if the test never reached it. Steps are matched by their text in order, so the same
 * step text appearing twice is matched twice.
 */
export function stepStatuses(gherkin: BddStep[], recorded: RecordedStep[]): DraftStep[] {
  let next = 0;
  return gherkin.map((step) => {
    const index = recorded.findIndex(
      (candidate, i) => i >= next && candidate.title === step.textWithKeyword,
    );
    const match = recorded[index];
    if (match === undefined) {
      return { text: step.textWithKeyword, status: 'not run', featureLine: step.gherkinStepLine };
    }
    next = index + 1;
    return {
      text: step.textWithKeyword,
      status: match.failed ? 'failed' : 'passed',
      featureLine: step.gherkinStepLine,
    };
  });
}
