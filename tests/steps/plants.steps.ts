import { expect } from '@playwright/test';
import { Given, Then, When } from '../fixtures/fixtures.ts';
import type { ScenarioState } from '../fixtures/fixtures.ts';
import { TEST_PREFIX, testPlantName } from '../fixtures/sprout-api.ts';

Given('a test plant exists', ({ testPlant }) => {
  // Asking for the fixture creates the plant; the check makes sure it is test data.
  expect(testPlant.name.startsWith(TEST_PREFIX)).toBe(true);
});

When('{word} starts editing the test plant', async ({ people, testPlant }, name: string) => {
  const person = await people.as(name);
  await person.startEditing(testPlant.name);
});

When('{word} saves the form', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.form.saveAndLeave();
});

Then(
  "{word}'s list shows the test plant as {string}",
  async ({ people, testPlant }, name: string, details: string) => {
    const person = await people.as(name);
    await person.plantList.expectPlant(testPlant.name, details);
  },
);

Then(
  'the server has the test plant with a watering interval of {int} days',
  async ({ api, testPlant }, days: number) => {
    // Polling is a web-first wait: it retries until the background sync has delivered the change.
    await expect.poll(async () => (await api.plant(testPlant.id)).wateringIntervalDays).toBe(days);
  },
);

const LIGHT_VALUES: Record<string, string> = {
  'Low light': 'low',
  'Medium light': 'medium',
  'Bright, indirect light': 'bright-indirect',
  'Direct sun': 'direct',
};

function lightValue(label: string): string {
  const value = LIGHT_VALUES[label];
  if (value === undefined) throw new Error(`Unknown light level "${label}" in a feature file.`);
  return value;
}

/** "the label Ben" gives "<test plant name> Ben", so the name keeps its wion-test- prefix. */
function labelled(testPlantName: string, label: string): string {
  return `${testPlantName} ${label}`;
}

When('{word} changes the light to {string}', async ({ people }, name: string, light: string) => {
  const person = await people.as(name);
  await person.form.fill({ light });
});

When(
  '{word} renames the test plant with the label {string}',
  async ({ people, testPlant }, name: string, label: string) => {
    const person = await people.as(name);
    await person.form.fill({ name: labelled(testPlant.name, label) });
  },
);

When(
  '{word} changes the watering interval to {int} days and saves',
  async ({ people }, name: string, days: number) => {
    const person = await people.as(name);
    await person.form.fill({ interval: days });
    await person.saveForm();
  },
);

When(
  '{word} changes the light to {string} and saves',
  async ({ people }, name: string, light: string) => {
    const person = await people.as(name);
    await person.form.fill({ light });
    await person.saveForm();
  },
);

When(
  '{word} renames the test plant with the label {string} and saves',
  async ({ people, testPlant }, name: string, label: string) => {
    const person = await people.as(name);
    await person.form.fill({ name: labelled(testPlant.name, label) });
    await person.saveForm();
  },
);

When(
  '{word} renames the test plant with the label {string} and sets {int} days, and saves',
  async ({ people, testPlant }, name: string, label: string, days: number) => {
    const person = await people.as(name);
    await person.form.fill({ name: labelled(testPlant.name, label), interval: days });
    await person.saveForm();
  },
);

Then(
  '{word} sees the test plant marked {string}',
  async ({ people, testPlant }, name: string, mark: string) => {
    const person = await people.as(name);
    await expect(person.plantList.textInRow(testPlant.name, mark)).toBeVisible();
  },
);

Then(
  'the server still has the test plant with a watering interval of {int} days',
  async ({ api, testPlant }, days: number) => {
    // No polling on purpose: this checks that nothing was sent, at this very moment.
    expect((await api.plant(testPlant.id)).wateringIntervalDays).toBe(days);
  },
);

Then(
  'the server has the test plant with {string}, watered every {int} days',
  async ({ api, testPlant }, light: string, days: number) => {
    await expect
      .poll(async () => {
        const plant = await api.plant(testPlant.id);
        return [plant.light, plant.wateringIntervalDays];
      })
      .toEqual([lightValue(light), days]);
  },
);

Then(
  'the server has the test plant named with the label {string}',
  async ({ api, testPlant }, label: string) => {
    await expect
      .poll(async () => (await api.plant(testPlant.id)).name)
      .toBe(labelled(testPlant.name, label));
  },
);

function rememberedNewPlant(scenario: ScenarioState): { name: string; light: string } {
  if (scenario.newPlant === undefined) {
    throw new Error('No new plant in this scenario yet: use "… adds a new plant …" first.');
  }
  return scenario.newPlant;
}

When(
  '{word} adds a new plant with light {string}, watered every {int} days',
  async ({ people, scenario, createdPlantNames }, name: string, light: string, days: number) => {
    const person = await people.as(name);
    const plantName = testPlantName();
    createdPlantNames.push(plantName);
    scenario.newPlant = { name: plantName, light };
    await person.plantList.addPlant.click();
    await person.form.fill({ name: plantName, light, interval: days });
    await person.form.saveAndLeave();
  },
);

Then(
  "{word}'s list shows the new plant as {string}",
  async ({ people, scenario }, name: string, details: string) => {
    const person = await people.as(name);
    await person.plantList.expectPlant(rememberedNewPlant(scenario).name, details);
  },
);

Then('the new plant is saved on the server', async ({ api, scenario }) => {
  const { name, light } = rememberedNewPlant(scenario);
  await expect.poll(async () => (await api.plantNamed(name))?.light).toBe(lightValue(light));
});
