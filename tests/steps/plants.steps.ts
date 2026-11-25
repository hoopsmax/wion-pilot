import { expect } from '@playwright/test';
import { Given, Then, When } from '../fixtures/fixtures.ts';
import { TEST_PREFIX } from '../fixtures/sprout-api.ts';

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
  await person.form.saveAndReturnToList();
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
