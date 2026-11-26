import type { AppMap, MappedField, Screen } from '../map/app-map.ts';
import type { Environment } from '../shared/config.ts';
import { ANSWER_SCHEMA } from './answer.ts';
import type { ExampleFeature } from './examples.ts';
import { redact, type Replaced } from './redact.ts';

export interface PromptInput {
  /** What to test, in the user's words; optional with a diff. */
  topic?: string;
  /** A code change from diff.ts; optional with a topic. */
  diff?: string;
  map: AppMap;
  /** The shared step library, as listSharedSteps returns it. */
  steps: string[];
  /** The hand-written features, which show how the steps go together (see examples.ts). */
  examples: ExampleFeature[];
}

export interface Prompt {
  system: string;
  user: string;
}

const RULES = `You write BDD test scenarios in Gherkin for a web app. A person reviews every scenario before it is used.

Rules:
- Use ONLY the steps listed under "Steps you may use". Copy their wording exactly. Replace {word} with a person's name as in the example features, {string} with text in double quotes, and {int} with a whole number.
- A step can depend on the steps before it. Copy the order you see in the example features (for example, a form is opened before a field is changed), and never leave out a step that sets things up.
- Never invent a step. If a behaviour needs a step that is not in the list, leave that scenario out and add the step to "missingSteps", with what it should do.
- One behaviour per scenario. Start with Given, then When, then Then; use And for more of the same kind.
- No selectors, code, URLs or technical details in the steps.
- If a code change is given: explain in "changeSummary", in plain words, what it changes for a user and what it could affect. In "testPlan", list what to check, including risks such as working offline, two people changing the same thing, and wrong input. Then write the scenarios. Without a code change, "changeSummary" is an empty string.
- "feature" is a short folder name in kebab-case, for example "watering-reminders".

Answer with one JSON object only, matching this JSON schema:
${JSON.stringify(ANSWER_SCHEMA)}`;

function fieldText(field: MappedField): string {
  const options = field.options ? `: ${field.options.join(', ')}` : '';
  return `${field.label} (${field.type}${options})`;
}

function screenText(screen: Screen): string {
  const name = screen.headings[0] ?? screen.title;
  const where = [screen.pattern, ...(screen.alsoAt ?? [])].join(', ');
  const fields = screen.forms.flatMap((form) => form.fields).map(fieldText);
  const named = (kind: string) =>
    screen.elements.filter((element) => element.kind === kind).map((element) => element.name);
  return [
    `- ${name} (${where})`,
    fields.length > 0 ? `  fields: ${fields.join('; ')}` : '',
    named('button').length > 0 ? `  buttons: ${named('button').join(', ')}` : '',
    named('link').length > 0 ? `  links: ${named('link').join(', ')}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** The app map in a few lines per screen: what a person sees, without screenshots or locators. */
export function summarizeMap(map: AppMap): string {
  return map.screens.map(screenText).join('\n');
}

function examplesSection(examples: ExampleFeature[]): string {
  const intro =
    'They show how the steps are combined and which ones must come first. Some of their steps ' +
    'are not in your list: never use those.';
  const features = examples.map(
    (example) => `### ${example.path}\n\n\`\`\`gherkin\n${example.text.trim()}\n\`\`\``,
  );
  return [`## Example features\n\n${intro}`, ...features].join('\n\n');
}

/** The request for a provider, before redaction. */
export function buildPrompt(input: PromptInput): Prompt {
  const topic = input.topic?.trim();
  if (!topic && !input.diff) {
    throw new Error('Say what to draft: a topic, a code change (--diff), or both.');
  }
  const sections = [
    topic ? `## What to test\n\n${topic}` : '',
    input.diff ? `## Code change\n\n\`\`\`diff\n${input.diff}\n\`\`\`` : '',
    `## Screens of the app\n\n${summarizeMap(input.map)}`,
    `## Steps you may use\n\n${input.steps.map((step) => `- ${step}`).join('\n')}`,
    examplesSection(input.examples),
  ].filter((section) => section !== '');
  return { system: RULES, user: sections.join('\n\n') };
}

/** Redacts both parts of a prompt; the counts tell the user what was removed. */
export function redactPrompt(
  prompt: Prompt,
  env: Environment,
): { prompt: Prompt; replaced: Replaced } {
  const system = redact(prompt.system, env);
  const user = redact(prompt.user, env);
  return {
    prompt: { system: system.text, user: user.text },
    replaced: {
      emails: system.replaced.emails + user.replaced.emails,
      secrets: system.replaced.secrets + user.replaced.secrets,
    },
  };
}
