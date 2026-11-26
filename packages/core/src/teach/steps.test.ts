import { describe, expect, test } from 'vitest';
import { isRecordedAction, stepsFor, type RecordedAction } from './steps.ts';

const ava = { person: 'Ava', given: ['Ava is signed in'] };

/** What adding a plant looks like to the recorder: one event per key while typing. */
const addPlant: RecordedAction[] = [
  { kind: 'click', name: 'Add plant' },
  { kind: 'fill', label: 'Name', value: 'w' },
  { kind: 'fill', label: 'Name', value: 'wion-test-fe' },
  { kind: 'fill', label: 'Name', value: 'wion-test-fern' },
  { kind: 'choose', label: 'Light', option: 'Medium light' },
  { kind: 'fill', label: 'Watering interval (days)', value: '5' },
  { kind: 'click', name: 'Save' },
  { kind: 'see', text: 'wion-test-fern' },
];

describe('stepsFor', () => {
  test('adding a plant: one step per action, the typed test name as {new name}', () => {
    expect(stepsFor(addPlant, ava)).toEqual({
      steps: [
        'Given Ava is signed in',
        'When Ava clicks "Add plant"',
        'And Ava fills "Name" with "{new name}"',
        'And Ava chooses "Medium light" in "Light"',
        'And Ava fills "Watering interval (days)" with "5"',
        'And Ava clicks "Save"',
        'Then Ava sees "{new name}"',
      ],
      notes: [],
    });
  });

  test('{new name} also inside names, and When again after a check', () => {
    const actions: RecordedAction[] = [
      ...addPlant,
      { kind: 'click', name: 'Edit wion-test-fern' },
      { kind: 'see', text: 'Edit plant' },
      { kind: 'see', text: 'wion-test-fern' },
    ];
    expect(stepsFor(actions, { person: 'Ava' }).steps.slice(-4)).toEqual([
      'Then Ava sees "{new name}"',
      'When Ava clicks "Edit {new name}"',
      'Then Ava sees "Edit plant"',
      'And Ava sees "{new name}"',
    ]);
  });

  test('a password is never recorded, only noted', () => {
    const actions: RecordedAction[] = [
      { kind: 'fill', label: 'Email', value: 'ava@sprout.test' },
      { kind: 'secret', label: 'Password' },
      { kind: 'secret', label: 'Password' },
      { kind: 'click', name: 'Sign in' },
    ];
    const result = stepsFor(actions, { person: 'Ava' });
    expect(result.steps).toEqual([
      'When Ava fills "Email" with "ava@sprout.test"',
      'And Ava clicks "Sign in"',
    ]);
    expect(result.notes).toContain(
      'Not recorded: what was typed into "Password" (passwords are never recorded).',
    );
  });

  test('what cannot become a step is noted, never dropped silently', () => {
    const actions: RecordedAction[] = [
      { kind: 'unnamed', what: 'button' },
      { kind: 'unsupported', what: 'checkbox "Remember me"' },
      { kind: 'click', name: 'Save' },
      { kind: 'fill', label: 'Name', value: 'wion-test-a' },
      { kind: 'fill', label: 'Notes', value: 'wion-test-b' },
    ];
    expect(stepsFor(actions, { person: 'Ava' }).notes).toEqual([
      'Only one {new name} per recording: "wion-test-b" is kept as typed.',
      'Not recorded: a click on a button without a name. Give it a label or text.',
      'Not recorded: checkbox "Remember me" (wion teach does not record this yet).',
      'No check was recorded: Option+click (Alt+click) a text to check that it is shown.',
    ]);
  });

  test('a text with double quotes is quoted with single quotes', () => {
    const steps = stepsFor([{ kind: 'see', text: 'Say "hi"' }], { person: 'Ava' }).steps;
    expect(steps).toEqual([`Then Ava sees 'Say "hi"'`]);
  });

  test('nothing recorded is an error that says what to do', () => {
    expect(() => stepsFor([{ kind: 'secret', label: 'Password' }], ava)).toThrow(
      /Nothing was recorded: click, type or choose something/,
    );
  });
});

describe('isRecordedAction', () => {
  test.each([
    [{ kind: 'click', name: 'Save' }, true],
    [{ kind: 'see', text: 'Plants' }, true],
    [{ kind: 'drag', name: 'x' }, false],
    [{ kind: 'click', name: 7 }, false],
    ['click', false],
    [null, false],
  ])('%j is a recorded action: %s', (value, ok) => {
    expect(isRecordedAction(value)).toBe(ok);
  });
});
