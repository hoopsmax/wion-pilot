import { Then, When, type ScenarioState } from '../fixtures/fixtures.ts';
import { testPlantName } from '../fixtures/sprout-api.ts';

/**
 * Generic steps, one per kind of action a person takes on any screen. wion teach records
 * scenarios with them; names are the ones a person sees, as in the app map.
 */

/** In a step's text, this stands for one fresh test name per scenario. */
export const NEW_NAME = '{new name}';

/**
 * Replaces {new name} with this scenario's test name, made on first use. Like every plant a test
 * creates, it is named wion-test-… and deleted after the test.
 */
function withNewName(text: string, scenario: ScenarioState, createdPlantNames: string[]): string {
  if (!text.includes(NEW_NAME)) return text;
  if (scenario.newName === undefined) {
    scenario.newName = testPlantName();
    createdPlantNames.push(scenario.newName);
  }
  return text.replaceAll(NEW_NAME, scenario.newName);
}

When(
  '{word} clicks {string}',
  async ({ people, scenario, createdPlantNames }, name: string, target: string) => {
    const person = await people.as(name);
    await person.screen.click(withNewName(target, scenario, createdPlantNames));
  },
);

When(
  '{word} fills {string} with {string}',
  async ({ people, scenario, createdPlantNames }, name: string, label: string, value: string) => {
    const person = await people.as(name);
    await person.screen.fill(label, withNewName(value, scenario, createdPlantNames));
  },
);

When(
  '{word} chooses {string} in {string}',
  async ({ people, scenario, createdPlantNames }, name: string, option: string, label: string) => {
    const person = await people.as(name);
    await person.screen.choose(label, withNewName(option, scenario, createdPlantNames));
  },
);

Then(
  '{word} sees {string}',
  async ({ people, scenario, createdPlantNames }, name: string, text: string) => {
    const person = await people.as(name);
    await person.screen.expectText(withNewName(text, scenario, createdPlantNames));
  },
);
