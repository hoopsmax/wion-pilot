import { describe, expect, test } from 'vitest';
import { expectedAndActual, stripAnsi } from './expected-actual.ts';

const ESC = String.fromCharCode(27);

describe('expectedAndActual', () => {
  test('reads a toHaveText failure', () => {
    const message = [
      'Error: expect(locator).toHaveText(expected) failed',
      '',
      "Locator:  getByRole('alert')",
      'Expected: "Welcome back!"',
      'Received: "Email or password is wrong."',
      'Timeout:  5000ms',
    ].join('\n');
    expect(expectedAndActual(message)).toEqual({
      expected: '"Welcome back!"',
      actual: '"Email or password is wrong."',
    });
  });

  test('reads variants such as "Expected string" and ignores colour codes', () => {
    const message = `${ESC}[31mExpected string: ${ESC}[39m"a"\n${ESC}[31mReceived string: ${ESC}[39m"b"`;
    expect(expectedAndActual(message)).toEqual({ expected: '"a"', actual: '"b"' });
  });

  test('reads the diff printed by toEqual', () => {
    const message = [
      'Error: expect(received).toEqual(expected) // deep equality',
      '',
      '- Expected  - 1',
      '+ Received  + 1',
      '',
      '  Array [',
      '-   "direct",',
      '+   "low",',
      '    9,',
      '  ]',
      '',
      'Call Log:',
      '- Timeout 5000ms exceeded while waiting on the predicate',
    ].join('\n');
    expect(expectedAndActual(message)).toEqual({
      expected: 'Array [\n  "direct",\n  9,\n]',
      actual: 'Array [\n  "low",\n  9,\n]',
    });
  });

  test('returns nothing when the error has no expected and received values', () => {
    expect(expectedAndActual('Error: Test timeout of 30000ms exceeded.')).toBeUndefined();
    expect(expectedAndActual('Expected: 1 but nothing was received')).toBeUndefined();
  });
});

describe('stripAnsi', () => {
  test('removes colour codes and keeps the text', () => {
    expect(stripAnsi(`${ESC}[2mexpect(${ESC}[22mlocator)`)).toBe('expect(locator)');
  });
});
