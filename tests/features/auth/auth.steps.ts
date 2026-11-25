import { expect } from '@playwright/test';
import { Then, When } from '../../fixtures/fixtures.ts';

When(
  '{word} signs in with the password {string}',
  async ({ people }, name: string, password: string) => {
    const person = await people.as(name);
    await person.signIn(password);
  },
);

Then('{word} sees the error {string}', async ({ people }, name: string, message: string) => {
  const person = await people.as(name);
  await expect(person.signInPage.error).toHaveText(message);
});

When('{word} signs out', async ({ people }, name: string) => {
  const person = await people.as(name);
  await person.plantList.signOut();
});
