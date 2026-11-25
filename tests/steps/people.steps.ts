import { expect } from '@playwright/test';
import { Given, Then, When } from '../fixtures/fixtures.ts';
import type { SyncStatus } from '../pages/sync-banner.ts';

Given('{word} is signed in', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.signIn();
  await person.plantList.waitUntilShown();
  await person.banner.expectStatus('Synced');
});

When('{word} signs in', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.signIn();
});

Then('{word} sees the plant list', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.plantList.waitUntilShown();
});

Then('{word} sees the sign-in screen', async ({ people }, name: string) => {
  const person = await people.as(name);
  await expect(person.signInPage.heading).toBeVisible();
});

Then("{word}'s banner says {string}", async ({ people }, name: string, status: string) => {
  const person = await people.as(name);
  await person.banner.expectStatus(status as SyncStatus);
});
