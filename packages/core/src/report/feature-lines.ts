/**
 * playwright-bdd turns each .feature file into a generated test file. That file names its source
 * ("// Generated from: …") and carries `bddFileData`: for every test and step, the line in the
 * generated file and the matching line in the .feature file. This module reads both, so a bug
 * report can point at the exact Gherkin line.
 */

export interface BddStep {
  pwStepLine: number;
  gherkinStepLine: number;
  textWithKeyword: string;
}

export interface BddTest {
  pwTestLine: number;
  pickleLine: number;
  steps: BddStep[];
}

export interface FeatureLines {
  featureFile: string;
  tests: BddTest[];
}

const FORMAT_HELP =
  'The generated test format of playwright-bdd may have changed; update packages/core/src/report/feature-lines.ts.';

function fail(problem: string): never {
  throw new Error(`Cannot read the .feature lines: ${problem}. ${FORMAT_HELP}`);
}

function isBddTest(value: unknown): value is BddTest {
  const test = value as BddTest;
  return (
    typeof test === 'object' &&
    typeof test.pwTestLine === 'number' &&
    typeof test.pickleLine === 'number' &&
    Array.isArray(test.steps) &&
    test.steps.every(
      (step) =>
        typeof step.pwStepLine === 'number' &&
        typeof step.gherkinStepLine === 'number' &&
        typeof step.textWithKeyword === 'string',
    )
  );
}

/** Reads the .feature path and the line map out of a generated test file's source. */
export function readFeatureLines(generatedSource: string): FeatureLines {
  const featureFile = /^\/\/ Generated from: (.+)$/m.exec(generatedSource)?.[1]?.trim();
  if (!featureFile) fail('no "// Generated from:" line');

  const start = generatedSource.indexOf('// bdd-data-start');
  const end = generatedSource.indexOf('// bdd-data-end');
  if (start < 0 || end < start) fail('no bdd-data block');

  // One JSON object per line between the markers, each followed by a comma.
  const tests = generatedSource
    .slice(start, end)
    .split('\n')
    .slice(1)
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line.startsWith('{'))
    .map((line) => {
      const parsed: unknown = JSON.parse(line);
      if (!isBddTest(parsed)) fail('a test entry has an unexpected shape');
      return parsed;
    });
  return { featureFile, tests };
}

/** The test whose generated code starts at this line, or undefined. */
export function testAtLine(lines: FeatureLines, pwTestLine: number): BddTest | undefined {
  return lines.tests.find((test) => test.pwTestLine === pwTestLine);
}
