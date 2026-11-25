import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import type { Plant } from '../../../apps/sprout/src/shared/plant.ts';
import type { AppMap, Screen } from '../../../packages/core/src/map/app-map.ts';
import { fieldRules } from '../../../packages/core/src/map/viewer.ts';
import { Given, Then, When, type ScenarioState } from '../../fixtures/fixtures.ts';
import { CREDENTIALS } from '../../fixtures/people.ts';
import { TEST_PREFIX } from '../../fixtures/sprout-api.ts';
import { freePort, runWionMap, type MapRun } from '../../fixtures/wion-cli.ts';

function lastRun(scenario: ScenarioState): MapRun {
  if (!scenario.mapRun) throw new Error('No map was made yet: start with "When Sprout is mapped".');
  return scenario.mapRun;
}

function mapOf(scenario: ScenarioState): AppMap {
  const run = lastRun(scenario);
  if (!run.map) {
    throw new Error(`wion map failed (exit ${String(run.exitCode)}):\n${run.output}`);
  }
  return run.map;
}

/** The name a person would give the screen: its first heading. */
function screenName(screen: Screen): string {
  return screen.headings[0] ?? screen.title;
}

/** Sprout's own plants, in a fixed order; other tests add wion-test- plants at the same time. */
function sproutPlants(plants: Plant[]): Plant[] {
  return plants
    .filter((plant) => !plant.name.startsWith(TEST_PREFIX))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function mapSprout(
  scenario: ScenarioState,
  { url, outDir, password }: { url: string | undefined; outDir: string; password: string },
): Promise<void> {
  if (url === undefined) throw new Error('No baseURL in playwright.config.ts.');
  scenario.mapRun = await runWionMap({ url, outDir, password });
}

When('Sprout is mapped', async ({ scenario, baseURL, $testInfo }) => {
  await mapSprout(scenario, {
    url: baseURL,
    outDir: $testInfo.outputPath('map'),
    password: CREDENTIALS.Ava.password,
  });
});

When('Sprout is mapped with a wrong password', async ({ scenario, baseURL, $testInfo }) => {
  await mapSprout(scenario, {
    url: baseURL,
    outDir: $testInfo.outputPath('map'),
    password: 'not-avas-password',
  });
});

When('an app that is not running is mapped', async ({ scenario, $testInfo }) => {
  await mapSprout(scenario, {
    url: `http://localhost:${String(await freePort())}`,
    outDir: $testInfo.outputPath('map'),
    password: CREDENTIALS.Ava.password,
  });
});

Then('the map shows these screens:', ({ scenario }, table: DataTable) => {
  const { screens } = mapOf(scenario);
  const expected = table.hashes() as { screen: string; address: string }[];
  for (const { screen, address } of expected) {
    const found = screens.find(
      (mapped) =>
        screenName(mapped) === screen &&
        (mapped.pattern === address || (mapped.alsoAt ?? []).includes(address)),
    );
    expect(found, `"${screen}" at ${address} is on the map`).toBeDefined();
  }
  // Other tests add plants meanwhile, so a screen may be mapped twice; never an unknown one.
  const names = expected.map((row) => row.screen);
  for (const mapped of screens) {
    expect(names, `${mapped.pattern} is a known screen`).toContain(screenName(mapped));
  }
});

Then('the {string} screen has these fields:', ({ scenario }, name: string, table: DataTable) => {
  const screen = mapOf(scenario).screens.find((mapped) => screenName(mapped) === name);
  if (!screen) throw new Error(`The map has no "${name}" screen.`);
  const fields = screen.forms.flatMap((form) => form.fields);
  expect(
    fields.map((field) => ({ field: field.label, type: field.type, rules: fieldRules(field) })),
  ).toEqual(table.hashes());
});

Then('every button, link and field on the map has a locator', ({ scenario }) => {
  const missing = mapOf(scenario).screens.flatMap((screen) =>
    screen.elements
      .filter((element) => element.locator === undefined)
      .map((element) => `${screen.pattern}: ${element.kind} "${element.name}"`),
  );
  expect(missing).toEqual([]);
});

Then('every screen on the map has a screenshot', async ({ scenario }) => {
  const run = lastRun(scenario);
  for (const screen of mapOf(scenario).screens) {
    const file = await stat(join(run.outDir, screen.screenshot));
    expect(file.size, `the screenshot of ${screen.pattern}`).toBeGreaterThan(0);
  }
});

Given('the plants as they are now', async ({ scenario, api }) => {
  scenario.plantsBefore = sproutPlants(await api.plants());
});

Then('no plant has changed', async ({ scenario, api }) => {
  // Only a map that really ran says anything about the data.
  mapOf(scenario);
  expect(sproutPlants(await api.plants())).toEqual(scenario.plantsBefore);
});

Then('the map fails with {string}', ({ scenario }, message: string) => {
  const run = lastRun(scenario);
  expect(run.exitCode, run.output).toBe(1);
  expect(run.output).toContain(message);
});
