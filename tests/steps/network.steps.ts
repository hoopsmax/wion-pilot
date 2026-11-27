import { expect } from '@playwright/test';
import { Given, Then, When } from '../fixtures/fixtures.ts';

Given('{word} goes offline', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.goOffline();
});

Given("{word}'s next request to the server will fail", async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.failNextServerRequest();
});

When('{word} goes back online', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.goOnline();
});

Then("all of {word}'s changes are synced", async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.expectAllSynced();
});

Then('{word} cannot sign out yet', async ({ people }, name: string) => {
  const person = await people.as(name);
  await expect(person.plantList.signOutButton).toBeDisabled();
  await expect(person.plantList.signOutHint).toBeVisible();
});
