import { expect } from '@playwright/test';
import { Then, When } from '../../fixtures/fixtures.ts';

When(
  '{word} changes the watering interval to {int} days',
  async ({ people }, name: string, days: number) => {
    const person = await people.as(name);
    await person.form.fill({ interval: days });
  },
);

When(
  '{word} tries to add a plant named {string} with light {string}, watered every {string} days',
  async (
    { people, createdPlantNames },
    name: string,
    plantName: string,
    light: string,
    days: string,
  ) => {
    const person = await people.as(name);
    // Registered for clean-up too: if validation ever let it through, it must not stay behind.
    if (plantName !== '') createdPlantNames.push(plantName);
    await person.plantList.addPlant.click();
    await person.form.fill({ name: plantName, light, interval: days });
    await person.form.save.click();
  },
);

Then(
  "{word}'s {string} field says {string}",
  async ({ people }, name: string, label: string, message: string) => {
    const person = await people.as(name);
    // The accessible description is what a screen reader announces for the field, so this also
    // proves the message is linked to its field, not just shown somewhere on the page.
    await expect(person.form.field(label)).toHaveAccessibleDescription(message);
  },
);

Then('{word} is still on the {string} form', async ({ people }, name: string, title: string) => {
  const person = await people.as(name);
  await expect(person.form.heading(title as 'Add plant' | 'Edit plant')).toBeVisible();
});
