/** What an AI provider must answer: checked here, then turned into Gherkin by gherkin.ts. */

export interface DraftScenario {
  name: string;
  /** Whole Gherkin lines without indentation, each starting with Given, When, Then, And or But. */
  steps: string[];
}

/** A step the scenarios would need but the step library does not have; never used in a draft. */
export interface MissingStep {
  phrase: string;
  purpose: string;
}

export interface DraftAnswer {
  /** The feature folder name, in kebab-case, for example "watering-reminders". */
  feature: string;
  title: string;
  description: string;
  /** What the code change does, in plain words; empty without --diff. */
  changeSummary: string;
  /** What to check and why; may be empty for a small topic. */
  testPlan: string[];
  scenarios: DraftScenario[];
  missingSteps: MissingStep[];
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STEP_START = /^(Given|When|Then|And|But) \S/;

/**
 * The same shape as a JSON schema, for providers that can hold the model to it (Claude's
 * structured output, Ollama's `format`). Every property is required and nothing else is allowed.
 */
export const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'feature',
    'title',
    'description',
    'changeSummary',
    'testPlan',
    'scenarios',
    'missingSteps',
  ],
  properties: {
    feature: { type: 'string', description: 'Feature folder name in kebab-case.' },
    title: { type: 'string' },
    description: { type: 'string' },
    changeSummary: { type: 'string' },
    testPlan: { type: 'array', items: { type: 'string' } },
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'steps'],
        properties: {
          name: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    missingSteps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['phrase', 'purpose'],
        properties: { phrase: { type: 'string' }, purpose: { type: 'string' } },
      },
    },
  },
} as const;

class AnswerError extends Error {
  constructor(path: string, problem: string) {
    super(`The AI's answer is not usable: ${path} ${problem}`);
  }
}

function text(value: unknown, path: string, { allowEmpty = false } = {}): string {
  if (typeof value !== 'string') throw new AnswerError(path, 'must be text.');
  const trimmed = value.trim();
  if (!allowEmpty && trimmed === '') throw new AnswerError(path, 'must not be empty.');
  return trimmed;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new AnswerError(path, 'must be a list.');
  return value;
}

function field(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AnswerError(path, 'must be an object.');
  }
  return value as Record<string, unknown>;
}

function scenario(value: unknown, path: string): DraftScenario {
  const raw = field(value, path);
  const steps = list(raw['steps'], `${path}.steps`).map((step, index) => {
    const line = text(step, `${path}.steps[${String(index)}]`);
    if (!STEP_START.test(line)) {
      throw new AnswerError(
        `${path}.steps[${String(index)}]`,
        `must start with Given, When, Then, And or But: "${line}"`,
      );
    }
    return line;
  });
  if (steps.length === 0) throw new AnswerError(`${path}.steps`, 'must have at least one step.');
  if (/^(And|But) /.test(steps[0] ?? '')) {
    throw new AnswerError(`${path}.steps[0]`, 'cannot start with And or But.');
  }
  return { name: text(raw['name'], `${path}.name`), steps };
}

/** Checks an answer that is already JSON; every problem names where it is. */
export function parseAnswer(value: unknown): DraftAnswer {
  const raw = field(value, 'the answer');
  const feature = text(raw['feature'], 'feature');
  if (!KEBAB.test(feature)) {
    throw new AnswerError('feature', `must be kebab-case, like "watering-reminders": "${feature}"`);
  }
  const scenarios = list(raw['scenarios'], 'scenarios').map((item, index) =>
    scenario(item, `scenarios[${String(index)}]`),
  );
  if (scenarios.length === 0)
    throw new AnswerError('scenarios', 'must have at least one scenario.');
  return {
    feature,
    title: text(raw['title'], 'title'),
    description: text(raw['description'], 'description', { allowEmpty: true }),
    changeSummary: text(raw['changeSummary'], 'changeSummary', { allowEmpty: true }),
    testPlan: list(raw['testPlan'], 'testPlan').map((item, index) =>
      text(item, `testPlan[${String(index)}]`),
    ),
    scenarios,
    missingSteps: list(raw['missingSteps'], 'missingSteps').map((item, index) => {
      const missing = field(item, `missingSteps[${String(index)}]`);
      return {
        phrase: text(missing['phrase'], `missingSteps[${String(index)}].phrase`),
        purpose: text(missing['purpose'], `missingSteps[${String(index)}].purpose`),
      };
    }),
  };
}

/**
 * Reads an answer given as text, for example pasted from a chat: the JSON may be wrapped in a
 * ```json fence or surrounded by a sentence, so the outermost { … } is taken.
 */
export function parseAnswerText(answer: string): DraftAnswer {
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start === -1 || end < start) {
    throw new Error(
      "The AI's answer contains no JSON object. Ask it to answer with the JSON only.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(answer.slice(start, end + 1));
  } catch (error) {
    throw new Error(`The AI's answer is not valid JSON (${String(error)}).`, { cause: error });
  }
  return parseAnswer(value);
}
