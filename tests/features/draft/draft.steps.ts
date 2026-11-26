import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { checkDraft } from '../../../packages/core/src/draft/check.ts';
import { Given, Then, When, type ScenarioState } from '../../fixtures/fixtures.ts';
import { runWion, type WionRun } from '../../fixtures/wion-cli.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const answers = join(import.meta.dirname, 'answers');
/** The feature every saved answer drafts, and the file review writes it to. */
const DRAFTED = 'watering-reminders-extra';

/** Each test keeps wion's files and the features it writes in its own folders. */
function folders(outputPath: (name: string) => string) {
  return { wionDir: outputPath('wion'), featuresDir: outputPath('features') };
}

function lastRun(scenario: ScenarioState): WionRun {
  if (!scenario.wionRun) throw new Error('No wion command has run yet in this scenario.');
  return scenario.wionRun;
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function draftSavedAnswer(
  scenario: ScenarioState,
  answer: string,
  outputPath: (name: string) => string,
) {
  const { wionDir } = folders(outputPath);
  scenario.wionRun = await runWion([
    'draft',
    '--answer',
    join(answers, `${answer}.json`),
    '--wion-dir',
    wionDir,
  ]);
}

When('the saved answer {string} is drafted', async ({ scenario, $testInfo }, answer: string) => {
  await draftSavedAnswer(scenario, answer, (name) => $testInfo.outputPath(name));
});

Given('the saved answer {string} was drafted', async ({ scenario, $testInfo }, answer: string) => {
  await draftSavedAnswer(scenario, answer, (name) => $testInfo.outputPath(name));
  expect(lastRun(scenario).exitCode, lastRun(scenario).output).toBe(0);
});

Then('the draft passes the check', ({ scenario }) => {
  const run = lastRun(scenario);
  expect(run.exitCode, run.output).toBe(0);
  expect(run.output).toContain('It passed the check.');
});

Then('the draft fails the check, naming {string}', ({ scenario }, step: string) => {
  const run = lastRun(scenario);
  expect(run.exitCode, run.output).toBe(1);
  expect(run.output).toContain(`Unknown step: ${step}`);
});

Then('there is a proposal for {string}', async ({ $testInfo }, feature: string) => {
  const { wionDir } = folders((name) => $testInfo.outputPath(name));
  expect(await exists(join(wionDir, 'proposals', `${feature}.feature`))).toBe(true);
});

Then('no feature file has been written yet', async ({ $testInfo }) => {
  const { featuresDir } = folders((name) => $testInfo.outputPath(name));
  expect(await exists(featuresDir)).toBe(false);
});

async function review(
  scenario: ScenarioState,
  input: string,
  outputPath: (name: string) => string,
) {
  const { wionDir, featuresDir } = folders(outputPath);
  scenario.wionRun = await runWion(
    ['review', '--wion-dir', wionDir, '--features-dir', featuresDir],
    { input },
  );
  expect(scenario.wionRun.exitCode, scenario.wionRun.output).toBe(0);
}

Then('the review does not offer {string}', async ({ scenario, $testInfo }, feature: string) => {
  await review(scenario, '', (name) => $testInfo.outputPath(name));
  expect(lastRun(scenario).output).toContain(`Not offered: ${feature} failed the check`);
  expect(lastRun(scenario).output).not.toContain('Approve?');
});

When(
  'the reviewer approves the first scenario and rejects the second',
  async ({ scenario, $testInfo }) => {
    await review(scenario, 'y\nn\n', (name) => $testInfo.outputPath(name));
  },
);

async function writtenFeature(outputPath: (name: string) => string): Promise<string> {
  const { featuresDir } = folders(outputPath);
  return readFile(join(featuresDir, DRAFTED, `${DRAFTED}.feature`), 'utf8');
}

Then('the written feature has the scenario {string}', async ({ $testInfo }, name: string) => {
  expect(await writtenFeature((n) => $testInfo.outputPath(n))).toContain(`Scenario: ${name}\n`);
});

Then(
  'the written feature does not have the scenario {string}',
  async ({ $testInfo }, name: string) => {
    expect(await writtenFeature((n) => $testInfo.outputPath(n))).not.toContain(`Scenario: ${name}`);
  },
);

Then('the written feature passes the check', async ({ $testInfo }) => {
  const text = await writtenFeature((name) => $testInfo.outputPath(name));
  expect(await checkDraft(repoRoot, text)).toEqual({ ok: true });
});

When(
  'a prompt about {string} is made with the password {string} set',
  async ({ scenario, $testInfo }, topic: string, password: string) => {
    const { wionDir } = folders((name) => $testInfo.outputPath(name));
    scenario.wionRun = await runWion(['draft', topic, '--wion-dir', wionDir], {
      env: { SPROUT_PASSWORD: password },
    });
    expect(scenario.wionRun.exitCode, scenario.wionRun.output).toBe(0);
  },
);

async function savedPrompt(outputPath: (name: string) => string): Promise<string> {
  const prompts = join(folders(outputPath).wionDir, 'prompts');
  const [file] = await readdir(prompts);
  if (!file) throw new Error('No prompt was saved.');
  return readFile(join(prompts, file), 'utf8');
}

Then('the saved prompt does not contain {string}', async ({ $testInfo }, text: string) => {
  expect(await savedPrompt((name) => $testInfo.outputPath(name))).not.toContain(text);
});

Then('the saved prompt contains {string}', async ({ $testInfo }, text: string) => {
  expect(await savedPrompt((name) => $testInfo.outputPath(name))).toContain(text);
});
