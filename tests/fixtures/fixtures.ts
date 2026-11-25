import { createBdd, test as base } from 'playwright-bdd';
import type { Plant } from '../../apps/sprout/src/shared/plant.ts';
import { Person } from '../pages/person.ts';
import { personNamed } from './people.ts';
import { SproutApi, testPlantName } from './sprout-api.ts';

interface People {
  /** The person with this name, each in their own browser; opened on first use. */
  as(name: string): Promise<Person>;
}

/** What one scenario remembers between its steps. Fresh for every test, never shared. */
export interface ScenarioState {
  newPlantName?: string;
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

  people: async ({ page, browser, baseURL }, use) => {
    const opened = new Map<string, Person>();
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
        const person = new Person(known, personPage);
        opened.set(known, person);
        return person;
      },
    });
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
    });
    await use(plant);
    await api.deletePlant(plant.id);
  },

  createdPlantNames: async ({ api }, use) => {
    const names: string[] = [];
    await use(names);
    const leftovers = (await api.plants()).filter((plant) => names.includes(plant.name));
    await Promise.all(leftovers.map((plant) => api.deletePlant(plant.id)));
  },
});

export const { Given, When, Then } = createBdd(test);
