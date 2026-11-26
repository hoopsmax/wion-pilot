import { describe, expect, test } from 'vitest';
import { parseAnswer, parseAnswerText, type DraftAnswer } from './answer.ts';

const good: DraftAnswer = {
  feature: 'watering-reminders',
  title: 'Watering reminders',
  description: 'Each plant says when to water it next.',
  changeSummary: '',
  testPlan: ['Each wording of the reminder'],
  scenarios: [
    {
      name: 'A plant due today',
      steps: [
        'Given the test plant is watered every 3 days and was last watered 3 days ago',
        'And Ava is signed in',
        'Then Ava sees the test plant marked "Water today"',
      ],
    },
  ],
  missingSteps: [{ phrase: 'Ava sorts the list by due date', purpose: 'There is no sorting yet.' }],
};

describe('parseAnswer', () => {
  test('accepts a complete answer', () => {
    expect(parseAnswer(good)).toEqual(good);
  });

  test.each([
    [{ ...good, feature: 'Watering Reminders' }, /feature must be kebab-case/],
    [{ ...good, scenarios: [] }, /scenarios must have at least one scenario/],
    [{ ...good, title: 7 }, /title must be text/],
    [
      { ...good, scenarios: [{ name: 'x', steps: ['Ava is signed in'] }] },
      /scenarios\[0\]\.steps\[0\] must start with Given/,
    ],
    [
      { ...good, scenarios: [{ name: 'x', steps: ['And Ava is signed in'] }] },
      /cannot start with And or But/,
    ],
    [{ ...good, missingSteps: [{ phrase: 'x' }] }, /missingSteps\[0\]\.purpose must be text/],
    ['just text', /the answer must be an object/],
  ])('explains what is wrong: %#', (answer, message) => {
    expect(() => parseAnswer(answer)).toThrow(message);
  });
});

describe('parseAnswerText', () => {
  test('finds the JSON in a pasted chat answer', () => {
    const pasted = `Here you go:\n\`\`\`json\n${JSON.stringify(good)}\n\`\`\`\nGood luck!`;
    expect(parseAnswerText(pasted)).toEqual(good);
  });

  test('says so when there is no JSON at all', () => {
    expect(() => parseAnswerText('Sorry, I cannot help.')).toThrow(/no JSON object/);
  });
});
