import { expect } from '@playwright/test';
import { Given, Then, When } from '../../fixtures/fixtures.ts';
import type { Person } from '../../pages/person.ts';

/** After a decision the app goes back to the list; wait until the decision reached the server. */
async function expectDecisionSent(person: Person): Promise<void> {
  await person.plantList.waitUntilShown();
  await person.expectAllSynced();
  await expect(person.banner.needsDecision).toHaveCount(0);
}

Given(
  '{word} and {word} both start editing the test plant',
  async ({ people, testPlant }, first: string, second: string) => {
    for (const name of [first, second]) {
      const person = await people.as(name);
      await person.startEditing(testPlant.name);
    }
  },
);

Given("{word}'s browser clock is controlled by the test", async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.controlClock();
});

When("{word}'s app refreshes in the background", async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.letBackgroundRefreshRun();
});

Then('{word} is not asked to decide anything', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.plantList.waitUntilShown();
  await expect(person.banner.needsDecision).toHaveCount(0);
  await expect(person.conflict.anyHeading).toHaveCount(0);
});

Then(
  '{word} is asked by {word} to decide only about {string}',
  async ({ people }, name: string, changedBy: string, field: string) => {
    const person = await people.as(name);
    await expect(person.conflict.heading(changedBy)).toBeVisible();
    await expect(person.conflict.askedFields).toHaveCount(1);
    await expect(person.conflict.field(field)).toBeVisible();
  },
);

When(
  '{word} keeps {string} for {string} and saves her choices',
  async ({ people }, name: string, side: string, field: string) => {
    const person = await people.as(name);
    await person.conflict.choice(field, side).check();
    await person.conflict.saveChoices.click();
    await expectDecisionSent(person);
  },
);

When('{word} takes all the latest values', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.conflict.takeAllLatest.click();
  await expectDecisionSent(person);
});

When(
  '{word} starts adding a plant named {string}',
  async ({ people, createdPlantNames }, name: string, plantName: string) => {
    const person = await people.as(name);
    // Never saved in the scenario, but registered so a mistake could not leave it behind.
    createdPlantNames.push(plantName);
    await person.plantList.addPlant.click();
    await person.form.fill({ name: plantName });
  },
);

Then("{word}'s banner offers to review a decision", async ({ people }, name: string) => {
  const person = await people.as(name);
  await expect(person.banner.review).toBeVisible();
});

Then(
  '{word} is still on the {string} form with the name {string}',
  async ({ people }, name: string, title: string, plantName: string) => {
    const person = await people.as(name);
    await expect(person.form.heading(title as 'Add plant' | 'Edit plant')).toBeVisible();
    await expect(person.form.name).toHaveValue(plantName);
  },
);
