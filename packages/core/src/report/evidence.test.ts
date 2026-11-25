import { describe, expect, test } from 'vitest';
import { evidenceFrom } from './evidence.ts';

describe('evidenceFrom', () => {
  test('links screenshot, video and trace relative to the draft and skips other attachments', () => {
    const evidence = evidenceFrom(
      [
        { name: 'trace', path: '/repo/test-results/t/trace.zip' },
        { name: 'screenshot', path: '/repo/test-results/t/test-failed-1.png' },
        { name: 'wion-browser-log' },
        { name: 'error-context', path: '/repo/test-results/t/error-context.md' },
      ],
      '/repo/reports/bugs',
    );
    expect(evidence).toEqual([
      { label: 'Screenshot', path: '../../test-results/t/test-failed-1.png' },
      { label: 'Trace', path: '../../test-results/t/trace.zip' },
    ]);
  });

  test('numbers the screenshots of two browsers in order', () => {
    const evidence = evidenceFrom(
      [
        { name: 'screenshot', path: '/r/test-failed-2.png' },
        { name: 'screenshot', path: '/r/test-failed-1.png' },
      ],
      '/r',
    );
    expect(evidence).toEqual([
      { label: 'Screenshot 1', path: 'test-failed-1.png' },
      { label: 'Screenshot 2', path: 'test-failed-2.png' },
    ]);
  });
});
