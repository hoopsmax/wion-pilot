import { join } from 'node:path';
import { expect } from '@playwright/test';
import { checkDraft } from '../../../packages/core/src/draft/check.ts';
import { startRecording } from '../../../packages/core/src/teach/recorder.ts';
import { stepsFor, type RecordedAction } from '../../../packages/core/src/teach/steps.ts';
import { Given, Then, When, type ScenarioState } from '../../fixtures/fixtures.ts';
import { CREDENTIALS } from '../../fixtures/people.ts';
import { runWion, type WionRun } from '../../fixtures/wion-cli.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

/** What has been recorded so far, as raw actions and as the steps and notes wion teach writes. */
async function recorded(scenario: ScenarioState) {
  if (!scenario.recording) {
    throw new Error('Nothing is being recorded: start with "wion is recording what Ava does".');
  }
  const actions: RecordedAction[] = await scenario.recording.recording.stop();
  return { actions, ...stepsFor(actions, { person: scenario.recording.person }) };
}

function newPlantName(scenario: ScenarioState): string {
  if (!scenario.newPlant) throw new Error('No new plant yet: use "… adds a new plant …" first.');
  return scenario.newPlant.name;
}

/** Gherkin removes a doc string's indentation; its lines are compared one by one. */
function lines(docString: string): string[] {
  return docString.split('\n').map((line) => line.trim());
}

Given('wion is recording what {word} does', async ({ people, scenario }, name: string) => {
  const person = await people.as(name);
  scenario.recording = { person: name, recording: await startRecording(person.page) };
});

When("{word} points out the new plant's name", async ({ people, scenario }, name: string) => {
  const person = await people.as(name);
  await person.screen.pointOut(newPlantName(scenario));
});

When('{word} opens the new plant for editing', async ({ people, scenario }, name: string) => {
  const person = await people.as(name);
  await person.plantList.editLink(newPlantName(scenario)).click();
});

Then('the recording reads:', async ({ scenario }, docString: string) => {
  expect((await recorded(scenario)).steps).toEqual(lines(docString));
});

Then('the recording ends with:', async ({ scenario }, docString: string) => {
  const expected = lines(docString);
  expect((await recorded(scenario)).steps.slice(-expected.length)).toEqual(expected);
});

Then('the recorded steps pass the check', async ({ scenario }) => {
  const { steps } = await recorded(scenario);
  const feature = [
    'Feature: Recorded',
    '  Scenario: Recorded',
    '    Given Ava is signed in',
    ...steps.map((step) => `    ${step}`),
    '',
  ].join('\n');
  expect(await checkDraft(repoRoot, feature)).toEqual({ ok: true });
});

Then('the recording does not contain {string}', async ({ scenario }, text: string) => {
  expect(JSON.stringify(await recorded(scenario))).not.toContain(text);
});

Then('the recording notes that the password was not recorded', async ({ scenario }) => {
  expect((await recorded(scenario)).notes).toContain(
    'Not recorded: what was typed into "Password" (passwords are never recorded).',
  );
});

function lastRun(scenario: ScenarioState): WionRun {
  if (!scenario.wionRun) throw new Error('wion teach has not run yet in this scenario.');
  return scenario.wionRun;
}

When(
  'wion teach is started and finished at once, without a window',
  async ({ scenario, baseURL, $testInfo }) => {
    if (baseURL === undefined) throw new Error('No baseURL in playwright.config.ts.');
    // Enter finishes the recording as soon as it has started; the input stays open, like a
    // terminal's, so the command must give the shell back by itself.
    scenario.wionRun = await runWion(
      ['teach', baseURL, 'Doing nothing', '--headless', '--wion-dir', $testInfo.outputPath('wion')],
      { input: '\n', keepInputOpen: true, env: { SPROUT_PASSWORD: CREDENTIALS.Ava.password } },
    );
  },
);

Then('wion teach says it signed in and started recording', ({ scenario }) => {
  const { output } = lastRun(scenario);
  expect(output).toContain('Signed in at /sign-in, as Ava.');
  expect(output).toContain('Recording "Doing nothing".');
});

Then('wion teach explains that nothing was recorded', ({ scenario }) => {
  const run = lastRun(scenario);
  expect(run.exitCode, run.output).toBe(1);
  expect(run.output).toContain('Nothing was recorded: click, type or choose something');
});
