import { describe, expect, test } from 'vitest';
import { readFeatureLines, testAtLine } from './feature-lines.ts';

// A trimmed copy of what playwright-bdd 9 generates for tests/features/auth/auth.feature.
const generated = `// Generated from: tests/features/auth/auth.feature
import { test } from "../../../../tests/fixtures/fixtures.ts";

test.describe('Signing in and out', () => {
  test('A wrong password is refused', async ({ When, Then }) => {
    await When('Ava signs in with the password "x"', null, { people });
    await Then('Ava sees the error "Email or password is wrong."', null, { people });
  });
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":5,"pickleLine":9,"tags":[],"steps":[{"pwStepLine":6,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"When Ava signs in with the password \\"x\\"","stepMatchArguments":[]},{"pwStepLine":7,"gherkinStepLine":11,"keywordType":"Outcome","textWithKeyword":"Then Ava sees the error \\"Email or password is wrong.\\"","stepMatchArguments":[]}]},
]; // bdd-data-end`;

describe('readFeatureLines', () => {
  test('finds the .feature file and the Gherkin line of every step', () => {
    const lines = readFeatureLines(generated);
    expect(lines.featureFile).toBe('tests/features/auth/auth.feature');
    const scenario = testAtLine(lines, 5);
    expect(scenario?.pickleLine).toBe(9);
    expect(scenario?.steps.map((step) => [step.gherkinStepLine, step.textWithKeyword])).toEqual([
      [10, 'When Ava signs in with the password "x"'],
      [11, 'Then Ava sees the error "Email or password is wrong."'],
    ]);
  });

  test('an unknown test line gives nothing', () => {
    expect(testAtLine(readFeatureLines(generated), 99)).toBeUndefined();
  });

  test('fails loudly when the generated format changed', () => {
    expect(() => readFeatureLines('const x = 1;')).toThrow(/Generated from/);
    expect(() => readFeatureLines('// Generated from: a.feature\nno data here')).toThrow(
      /bdd-data block/,
    );
    const odd =
      '// Generated from: a.feature\n// bdd-data-start\n  {"pwTestLine":"5"},\n// bdd-data-end';
    expect(() => readFeatureLines(odd)).toThrow(/unexpected shape/);
  });
});
