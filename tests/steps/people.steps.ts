import { expect } from '@playwright/test';
import { Given, Then, When } from '../fixtures/fixtures.ts';
import type { SyncStatus } from '../pages/sync-banner.ts';

Given('{word} is signed in', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.signInAndWaitForSync();
});

Given(
  '{word} and {word} are signed in on separate devices',
  async ({ people }, first: string, second: string) => {
    for (const name of [first, second]) {
      const person = await people.as(name);
      await person.signInAndWaitForSync();
    }
  },
);

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
