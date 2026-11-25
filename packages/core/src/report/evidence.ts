import { relative } from 'node:path';
import type { Evidence } from './draft.ts';

const LABELS: Record<string, string> = {
  screenshot: 'Screenshot',
  video: 'Video',
  trace: 'Trace',
};

export interface Attachment {
  name: string;
  path?: string;
}

/**
 * The screenshots, videos and traces of a test, as links relative to the draft. A test with two
 * people has one screenshot and video per browser, so those are numbered: "Screenshot 1", "… 2".
 */
export function evidenceFrom(attachments: Attachment[], draftDir: string): Evidence[] {
  const files = attachments
    .flatMap((a) => {
      const label = LABELS[a.name];
      return label && a.path ? [{ label, path: a.path }] : [];
    })
    .sort((a, b) => a.label.localeCompare(b.label) || a.path.localeCompare(b.path));
  return files.map((file) => {
    const same = files.filter((other) => other.label === file.label);
    const label = same.length > 1 ? `${file.label} ${String(same.indexOf(file) + 1)}` : file.label;
    return { label, path: relative(draftDir, file.path) };
  });
}
