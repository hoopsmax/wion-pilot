/** One thing a person did in the browser while wion teach was recording. */
export type RecordedAction =
  | { kind: 'click'; name: string }
  | { kind: 'fill'; label: string; value: string }
  | { kind: 'choose'; label: string; option: string }
  | { kind: 'see'; text: string }
  | { kind: 'secret'; label: string }
  | { kind: 'unnamed'; what: string }
  | { kind: 'unsupported'; what: string };

/** In a recorded step, this stands for the test name the person typed (see tests/steps/ui.steps.ts). */
export const NEW_NAME = '{new name}';

/** Typed values that start like this are test data: one fresh name per test run. */
export const TEST_DATA_PREFIX = 'wion-test-';

export interface RecordingOptions {
  /** The one-word name the steps use for the person, for example "Ava". */
  person: string;
  /** Steps that set the scene before the recording, for example "Ava is signed in". */
  given?: string[];
  testDataPrefix?: string;
}

export interface RecordedScenario {
  steps: string[];
  /** What could not become a step, in plain words; never a typed password. */
  notes: string[];
}

const KINDS = new Set<RecordedAction['kind']>([
  'click',
  'fill',
  'choose',
  'see',
  'secret',
  'unnamed',
  'unsupported',
]);

/** Actions come from the page; anything that is not one of ours is refused before it is used. */
export function isRecordedAction(value: unknown): value is RecordedAction {
  if (typeof value !== 'object' || value === null) return false;
  const action = value as Record<string, unknown>;
  const kind = action['kind'];
  if (typeof kind !== 'string' || !KINDS.has(kind as RecordedAction['kind'])) return false;
  return Object.entries(action).every(([, field]) => typeof field === 'string');
}

/** Typing fires an event per key; only the text the field ended with is a step. */
function mergeTyping(actions: RecordedAction[]): RecordedAction[] {
  const merged: RecordedAction[] = [];
  for (const action of actions) {
    const previous = merged.at(-1);
    const sameField =
      previous !== undefined &&
      (action.kind === 'fill' || action.kind === 'secret') &&
      previous.kind === action.kind &&
      previous.label === action.label;
    if (sameField) merged[merged.length - 1] = action;
    else merged.push(action);
  }
  return merged;
}

/** Every text an action carries, with the test name replaced by {new name}. */
function withNewName(action: RecordedAction, testName: string | undefined): RecordedAction {
  if (testName === undefined) return action;
  const swap = (text: string) => text.replaceAll(testName, NEW_NAME);
  return Object.fromEntries(
    Object.entries(action).map(([key, field]) => [key, key === 'kind' ? field : swap(field)]),
  ) as RecordedAction;
}

/** A step argument in quotes; undefined when the text holds both kinds of quote. */
function quoted(text: string): string | undefined {
  if (!text.includes('"')) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;
  return undefined;
}

/** The step for an action, or the note that explains why there is none. */
function stepOrNote(action: RecordedAction, person: string): { step: string } | { note: string } {
  switch (action.kind) {
    case 'secret':
      return {
        note: `Not recorded: what was typed into "${action.label}" (passwords are never recorded).`,
      };
    case 'unnamed':
      return {
        note: `Not recorded: a click on a ${action.what} without a name. Give it a label or text.`,
      };
    case 'unsupported':
      return { note: `Not recorded: ${action.what} (wion teach does not record this yet).` };
    default:
      break;
  }
  const parts =
    action.kind === 'click'
      ? [action.name]
      : action.kind === 'fill'
        ? [action.label, action.value]
        : action.kind === 'choose'
          ? [action.option, action.label]
          : [action.text];
  const [first, second] = parts.map(quoted);
  if (first === undefined || (parts.length === 2 && second === undefined)) {
    return { note: `Not recorded: a text with both kinds of quotes (${parts.join(', ')}).` };
  }
  if (action.kind === 'click') return { step: `${person} clicks ${first}` };
  if (action.kind === 'fill') return { step: `${person} fills ${first} with ${second ?? ''}` };
  if (action.kind === 'choose') return { step: `${person} chooses ${first} in ${second ?? ''}` };
  return { step: `${person} sees ${first}` };
}

/**
 * Turns a recording into the generic steps of the shared library (tests/steps/ui.steps.ts):
 * Given for the starting steps, When/And for actions, Then/And for checks.
 */
export function stepsFor(actions: RecordedAction[], options: RecordingOptions): RecordedScenario {
  const prefix = options.testDataPrefix ?? TEST_DATA_PREFIX;
  const merged = mergeTyping(actions);
  const typedTestNames = merged.flatMap((action) =>
    action.kind === 'fill' && action.value.startsWith(prefix) ? [action.value] : [],
  );
  const [testName, ...otherTestNames] = [...new Set(typedTestNames)];
  const notes = otherTestNames.map(
    (name) => `Only one {new name} per recording: "${name}" is kept as typed.`,
  );

  const steps = (options.given ?? []).map(
    (step, index) => `${index === 0 ? 'Given' : 'And'} ${step}`,
  );
  let phase: 'given' | 'when' | 'then' = 'given';
  let recordedSteps = 0;
  let checks = 0;
  for (const action of merged.map((one) => withNewName(one, testName))) {
    const result = stepOrNote(action, options.person);
    if ('note' in result) {
      notes.push(result.note);
      continue;
    }
    const isCheck = action.kind === 'see';
    const keyword = isCheck
      ? phase === 'then'
        ? 'And'
        : 'Then'
      : phase === 'when'
        ? 'And'
        : 'When';
    phase = isCheck ? 'then' : 'when';
    steps.push(`${keyword} ${result.step}`);
    recordedSteps += 1;
    if (isCheck) checks += 1;
  }
  if (recordedSteps === 0) {
    throw new Error('Nothing was recorded: click, type or choose something in the browser first.');
  }
  if (checks === 0) {
    notes.push('No check was recorded: Option+click (Alt+click) a text to check that it is shown.');
  }
  return { steps, notes };
}
