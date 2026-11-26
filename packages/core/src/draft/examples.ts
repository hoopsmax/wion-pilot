import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { DRAFT_TAG } from './gherkin.ts';

/** A feature tagged like this is never shown to the AI (it fails on purpose, or tests wion itself). */
export const NOT_AN_EXAMPLE_TAG = '@not-an-example';

export interface ExampleFeature {
  /** Relative to the project, for example "tests/features/conflict/conflict.feature". */
  path: string;
  text: string;
}

/** The tags written above `Feature:`, which apply to the whole feature. */
export function featureTags(text: string): string[] {
  const tags: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Feature:')) break;
    if (trimmed.startsWith('@')) tags.push(...trimmed.split(/\s+/));
  }
  return tags;
}

/** Hand-written features teach the AI how steps go together; its own drafts must not. */
export function isExample(text: string): boolean {
  const tags = featureTags(text);
  return !tags.includes(DRAFT_TAG) && !tags.includes(NOT_AN_EXAMPLE_TAG);
}

/**
 * Every hand-written feature, in a fixed order. They show the AI which steps have to come first,
 * for example that a form is opened before a field is changed: the step list alone cannot.
 */
export async function readExampleFeatures(
  root: string,
  folder = join('tests', 'features'),
): Promise<ExampleFeature[]> {
  const entries = await readdir(join(root, folder), { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.feature'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  const features = await Promise.all(
    files.map(async (file) => ({ path: relative(root, file), text: await readFile(file, 'utf8') })),
  );
  const examples = features.filter((feature) => isExample(feature.text));
  if (examples.length === 0) {
    throw new Error(`There is no hand-written feature in ${folder} to show the AI as an example.`);
  }
  return examples;
}
