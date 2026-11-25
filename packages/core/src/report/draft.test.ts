import { describe, expect, test } from 'vitest';
import { buildDraft, draftFileName, type DraftInput } from './draft.ts';

const input: DraftInput = {
  feature: 'Signing in and out',
  scenario: 'A wrong password is refused',
  featureFile: 'tests/features/auth/auth.feature',
  featureFileLink: '../../tests/features/auth/auth.feature',
  scenarioLine: 9,
  steps: [
    { text: 'When Ava signs in with the password "x"', status: 'passed', featureLine: 10 },
    { text: 'Then Ava sees the error "Welcome back!"', status: 'failed', featureLine: 11 },
    { text: 'And Ava sees the sign-in screen', status: 'not run', featureLine: 12 },
  ],
  errorMessage:
    'Error: expect(locator).toHaveText(expected) failed\nExpected: "Welcome back!"\nReceived: "Email or password is wrong."',
  when: new Date('2026-11-26T10:42:00Z'),
  browser: 'chromium',
  commit: 'abc1234def',
  evidence: [
    { label: 'Screenshot', path: '../../test-results/x/test-failed-1.png' },
    { label: 'Trace', path: '../../test-results/x/trace.zip' },
  ],
  consoleErrors: ['Failed to load resource: 401'],
  failedRequests: ['POST /api/session → 401 Unauthorized'],
};

describe('buildDraft', () => {
  const draft = buildDraft(input);

  test('starts with the draft warning', () => {
    expect(draft.startsWith('> **DRAFT: verify before filing.**')).toBe(true);
  });

  test('names the scenario, links the feature file and the failing line', () => {
    expect(draft).toContain('# Signing in and out: A wrong password is refused');
    expect(draft).toContain(
      '[tests/features/auth/auth.feature](../../tests/features/auth/auth.feature), line 9',
    );
    expect(draft).toContain('[line 11](../../tests/features/auth/auth.feature#L11)');
    expect(draft).toContain(
      '**When:** 2026-11-26 10:42 UTC · **Browser:** chromium · **Commit:** abc1234',
    );
  });

  test('lists the steps as passed, failing and not run', () => {
    expect(draft).toContain('1. When Ava signs in with the password "x" ✅');
    expect(draft).toContain('2. **Then Ava sees the error "Welcome back!" ❌ (fails here)**');
    expect(draft).toContain('3. And Ava sees the sign-in screen (not run)');
  });

  test('shows expected and actual from the error', () => {
    expect(draft).toContain('## Expected\n```text\n"Welcome back!"\n```');
    expect(draft).toContain('## Actual\n```text\n"Email or password is wrong."\n```');
  });

  test('links the evidence and explains how to open the trace', () => {
    expect(draft).toContain('- [Screenshot](../../test-results/x/test-failed-1.png)');
    expect(draft).toContain('`npx playwright show-trace ../../test-results/x/trace.zip`');
  });

  test('lists console errors and failed requests', () => {
    expect(draft).toContain('## Browser console errors\n- Failed to load resource: 401');
    expect(draft).toContain('## Failed network requests\n- POST /api/session → 401 Unauthorized');
  });
});

describe('a draft with less to report', () => {
  const draft = buildDraft({
    ...input,
    commit: undefined,
    evidence: [],
    consoleErrors: [],
    failedRequests: [],
    errorMessage: 'Error: Test timeout of 30000ms exceeded.',
  });

  test('has no Notes section when nothing is missing', () => {
    expect(draft).not.toContain('## Notes');
  });

  test('says "None." instead of leaving sections empty', () => {
    expect(draft).toContain('## Browser console errors\nNone.');
    expect(draft).toContain('## Failed network requests\nNone.');
    expect(draft).toContain('No screenshot, video or trace was kept for this test.');
    expect(draft).not.toContain('Commit');
  });

  test('without Expected and Received it does not invent them', () => {
    expect(draft).toContain('## Expected\nThe failing step passes.');
    expect(draft).toContain('## Actual\n```text\nError: Test timeout of 30000ms exceeded.\n```');
  });
});

describe('without a browser log', () => {
  test('console errors and requests are "unknown", not "none"', () => {
    const draft = buildDraft({ ...input, consoleErrors: undefined, failedRequests: undefined });
    expect(draft).toContain('## Browser console errors\nUnknown: no browser log was recorded');
    expect(draft).toContain('## Failed network requests\nUnknown: no browser log was recorded');
  });
});

describe('notes', () => {
  test('say openly what the reporter could not find out', () => {
    const draft = buildDraft({ ...input, notes: ['The .feature lines could not be read.'] });
    expect(draft).toContain('## Notes\n- The .feature lines could not be read.');
  });
});

describe('draftFileName', () => {
  test('is readable and safe for every file system', () => {
    expect(
      draftFileName(
        'tests/features/conflict/conflict.feature',
        'Only the clashing field (keeping "Yours")',
      ),
    ).toBe('conflict--only-the-clashing-field-keeping-yours.md');
  });
});
