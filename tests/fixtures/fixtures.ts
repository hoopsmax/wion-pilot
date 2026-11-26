import { createBdd, test as base } from 'playwright-bdd';
import type { Plant } from '../../apps/sprout/src/shared/plant.ts';
import { dayOf } from '../../apps/sprout/src/shared/watering.ts';
import type { BrowserLog } from '../../packages/core/src/report/bug-report-reporter.ts';
import { Person } from '../pages/person.ts';
import { attachIfFailed, recordBrowserLog } from './browser-log.ts';
import { personNamed } from './people.ts';
import { SproutApi, testPlantName } from './sprout-api.ts';
import type { MapRun, WionRun } from './wion-cli.ts';

interface People {
  /** The person with this name, each in their own browser; opened on first use. */
  as(name: string): Promise<Person>;
  /** Waits until everyone online has sent their changes to the server. */
  waitUntilChangesSent(): Promise<void>;
}

/** What one scenario remembers between its steps. Fresh for every test, never shared. */
export interface ScenarioState {
  /** The fresh test name that "{new name}" stands for in this scenario's steps. */
  newName?: string;
  /** A plant the scenario added through the form, with the light level it was given. */
  newPlant?: { name: string; light: string };
  /** The day the scenario treats as today (see "it is … on …'s device"). */
  today?: string;
  /** The last run of another wion command (draft, review). */
  wionRun?: WionRun;
  /** The last run of wion map. */
  mapRun?: MapRun;
  /** Sprout's own plants (not test data) before something happened. */
  plantsBefore?: Plant[];
}

interface Fixtures {
  scenario: ScenarioState;
  people: People;
  /** Sprout's API, signed in as Ben, for setting up data and checking the server. */
  api: SproutApi;
  /** A plant made for this test only, named wion-test-…, deleted after the test. */
  testPlant: Plant;
  /** Names of plants a test creates through the UI, deleted after the test. */
  createdPlantNames: string[];
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures always take their dependencies as the first argument.
  scenario: async ({}, use) => {
    await use({});
  },

  people: async ({ page, browser, baseURL }, use, testInfo) => {
    const opened = new Map<string, Person>();
    // Console errors and failed requests of everyone in the test, for its bug-report draft.
    const log: BrowserLog = { consoleErrors: [], failedRequests: [] };
    const extraContexts: { close(): Promise<void> }[] = [];
    await use({
      async as(name) {
        const known = personNamed(name);
        const existing = opened.get(known);
        if (existing) return existing;
        // The first person uses the test's own page, so its trace and video are kept on failure;
        // each further person gets a separate browser context, like a second device.
        let personPage = page;
        if (opened.size > 0) {
          const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}) });
          extraContexts.push(context);
          personPage = await context.newPage();
        }
        recordBrowserLog(personPage, known, log);
        const person = new Person(known, personPage);
        opened.set(known, person);
        return person;
      },
      async waitUntilChangesSent() {
        await Promise.all([...opened.values()].map((person) => person.waitUntilChangesSent()));
      },
    });
    await attachIfFailed(testInfo, log);
    await Promise.all(extraContexts.map((context) => context.close()));
  },

  api: async ({ request }, use) => {
    await use(await SproutApi.signIn(request, 'Ben'));
  },

  testPlant: async ({ api }, use) => {
    const plant = await api.createPlant({
      name: testPlantName(),
      light: 'medium',
      wateringIntervalDays: 7,
      lastWateredOn: dayOf(new Date()),
    });
    await use(plant);
    await api.deletePlant(plant.id);
  },

  createdPlantNames: async ({ api, people }, use) => {
    const names: string[] = [];
    await use(names);
    // A plant saved in a browser reaches the server a moment later. Deleting before that would
    // find nothing, and the plant would arrive after the cleanup and stay.
    if (names.length > 0) await people.waitUntilChangesSent();
    const leftovers = (await api.plants()).filter((plant) => names.includes(plant.name));
    await Promise.all(leftovers.map((plant) => api.deletePlant(plant.id)));
  },
});

export const { Given, When, Then } = createBdd(test);
