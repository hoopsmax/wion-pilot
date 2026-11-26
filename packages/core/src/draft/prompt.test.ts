import { describe, expect, test } from 'vitest';
import type { AppMap } from '../map/app-map.ts';
import { buildPrompt, redactPrompt, summarizeMap } from './prompt.ts';
import { redact } from './redact.ts';

const map: AppMap = {
  startUrl: 'http://localhost:4600/',
  createdAt: '2026-06-15T10:00:00.000Z',
  skipped: [],
  screens: [
    {
      pattern: '/',
      alsoAt: ['/plants'],
      url: 'http://localhost:4600/',
      title: 'Sprout',
      headings: ['Plants'],
      forms: [],
      elements: [
        { kind: 'button', role: 'button', name: 'Mark Window fern watered', locator: 'x' },
        { kind: 'link', role: 'link', name: 'Add plant', locator: 'y' },
      ],
      testIds: [],
      screenshot: 'screens/home.png',
    },
    {
      pattern: '/plants/new',
      url: 'http://localhost:4600/plants/new',
      title: 'Sprout',
      headings: ['Add plant'],
      forms: [
        {
          fields: [
            {
              label: 'Light',
              type: 'select',
              required: false,
              options: ['Low light', 'Direct sun'],
            },
          ],
        },
      ],
      elements: [],
      testIds: [],
      screenshot: 'screens/plants-new.png',
    },
  ],
};

const input = {
  map,
  steps: ['Given {word} is signed in', 'When {word} marks the test plant watered'],
  example: 'Feature: Example\n  Scenario: One\n    Given Ava is signed in\n',
};

describe('summarizeMap', () => {
  test('a few lines per screen: names, fields with options, buttons and links', () => {
    expect(summarizeMap(map)).toBe(
      [
        '- Plants (/, /plants)',
        '  buttons: Mark Window fern watered',
        '  links: Add plant',
        '- Add plant (/plants/new)',
        '  fields: Light (select: Low light, Direct sun)',
      ].join('\n'),
    );
  });
});

describe('buildPrompt', () => {
  test('a topic: the rules, the topic, the screens, the steps and the example', () => {
    const { system, user } = buildPrompt({ ...input, topic: 'watering reminders' });
    expect(system).toContain('Use ONLY the steps listed');
    expect(system).toContain('"missingSteps"');
    expect(user).toContain('## What to test\n\nwatering reminders');
    expect(user).toContain('- When {word} marks the test plant watered');
    expect(user).toContain('```gherkin\nFeature: Example');
    expect(user).not.toContain('## Code change');
  });

  test('a code change and a topic together', () => {
    const { user } = buildPrompt({ ...input, topic: 'reminders', diff: '+const a = 1;' });
    expect(user).toContain('## What to test\n\nreminders');
    expect(user).toContain('## Code change\n\n```diff\n+const a = 1;\n```');
  });

  test('nothing to draft is refused', () => {
    expect(() => buildPrompt({ ...input, topic: '  ' })).toThrow(/a topic, a code change/);
  });
});

describe('redaction', () => {
  test('secret environment values, emails, keys and hashes are replaced', () => {
    const text = [
      'password: sprout-ava',
      'mail ava@sprout.test',
      'key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789',
      'hash 3911ddcb73aef0df7ac95cae6ac32e914ace0e501955f6a7bf8b71b2eb8e80d5',
    ].join('\n');
    const result = redact(text, { SPROUT_PASSWORD: 'sprout-ava', HOME: '/home/someone' });
    expect(result.text).toBe(
      ['password: <secret>', 'mail <email>', 'key <secret>', 'hash <secret>'].join('\n'),
    );
    expect(result.replaced).toEqual({ emails: 1, secrets: 3 });
  });

  test('ids, ordinary words and non-secret variables are kept', () => {
    const text =
      'plant 5eed0000-0000-4000-8000-000000000001 in /home/someone, watered every 3 days';
    expect(redact(text, { HOME: '/home/someone' }).text).toBe(text);
  });

  test('a secret in the map or the diff never reaches the prompt', () => {
    const leaky = buildPrompt({
      ...input,
      topic: 'reminders',
      diff: '+const token = "ghp_0123456789abcdefghijklmnopqrstuvwxyz";\n+// ben@sprout.test',
    });
    const { prompt, replaced } = redactPrompt(leaky, {});
    expect(prompt.user).not.toContain('ghp_0123');
    expect(prompt.user).not.toContain('ben@sprout.test');
    expect(replaced).toEqual({ emails: 1, secrets: 1 });
  });
});
