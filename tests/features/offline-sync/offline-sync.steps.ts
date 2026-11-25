import { Given } from '../../fixtures/fixtures.ts';

Given(
  "{word} changed the test plant's watering interval to {int} days while offline",
  async ({ people, testPlant }, name: string, days: number) => {
    const person = await people.as(name);
    // The form is opened online: going offline first would make the page load itself fail.
    await person.startEditing(testPlant.name);
    await person.goOffline();
    await person.form.fill({ interval: days });
    await person.saveForm();
  },
);
