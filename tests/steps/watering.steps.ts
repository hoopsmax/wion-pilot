import { expect } from '@playwright/test';
import { fieldsOf } from '../../apps/sprout/src/shared/plant.ts';
import { addDays, isDay } from '../../apps/sprout/src/shared/watering.ts';
import { Given, Then, When, type ScenarioState } from '../fixtures/fixtures.ts';

function todayOf(scenario: ScenarioState): string {
  if (!scenario.today) {
    throw new Error('This step needs a fixed day first: Given it is "2026-06-15" on Ava\'s device');
  }
  return scenario.today;
}

Given(
  "it is {string} on {word}'s device",
  async ({ scenario, people }, day: string, name: string) => {
    if (!isDay(day)) throw new Error('The day in this step must look like 2026-06-15.');
    scenario.today = day;
    const person = await people.as(name);
    await person.fixToday(day);
  },
);

Given(
  'the test plant is watered every {int} days and was last watered {int} days ago',
  async ({ scenario, api, testPlant }, every: number, ago: number) => {
    await api.updatePlant(testPlant, {
      ...fieldsOf(testPlant),
      wateringIntervalDays: every,
      lastWateredOn: addDays(todayOf(scenario), -ago),
    });
  },
);

When('{word} marks the test plant watered', async ({ people, testPlant }, name: string) => {
  const person = await people.as(name);
  await person.plantList.markWatered(testPlant.name);
});

Then(
  'the server has the test plant last watered on {string}',
  async ({ api, testPlant }, day: string) => {
    await expect.poll(async () => (await api.plant(testPlant.id)).lastWateredOn).toBe(day);
  },
);
