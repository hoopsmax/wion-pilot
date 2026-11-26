import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { featureTags, isExample, readExampleFeatures } from './examples.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

describe('featureTags and isExample', () => {
  test('only the tags above Feature: count', () => {
    const text =
      '# a comment\n@demo-bug @not-an-example\nFeature: Demo\n  @slow\n  Scenario: One\n';
    expect(featureTags(text)).toEqual(['@demo-bug', '@not-an-example']);
  });

  test.each([
    ['Feature: Hand-written\n', true],
    ['@ai-drafted\nFeature: Drafted\n', false],
    ['@not-an-example\nFeature: Tests wion itself\n', false],
  ])('%j is an example: %s', (text, example) => {
    expect(isExample(text)).toBe(example);
  });
});

describe('readExampleFeatures', () => {
  test('reads every hand-written feature in a fixed order', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wion-examples-'));
    try {
      for (const [folder, text] of [
        ['b', 'Feature: B\n'],
        ['a', 'Feature: A\n'],
        ['drafted', '@ai-drafted\nFeature: Drafted\n'],
      ] as const) {
        await mkdir(join(root, 'tests', 'features', folder), { recursive: true });
        await writeFile(join(root, 'tests', 'features', folder, `${folder}.feature`), text);
      }
      expect(await readExampleFeatures(root)).toEqual([
        { path: join('tests', 'features', 'a', 'a.feature'), text: 'Feature: A\n' },
        { path: join('tests', 'features', 'b', 'b.feature'), text: 'Feature: B\n' },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("Sprout's examples: the app's own features, not the demo bug, wion's or AI drafts", async () => {
    const paths = (await readExampleFeatures(repoRoot)).map((example) => example.path);
    expect(paths).toEqual(
      ['auth', 'conflict', 'offline-sync', 'plants', 'reminders'].map((name) =>
        join('tests', 'features', name, `${name}.feature`),
      ),
    );
  });
});
