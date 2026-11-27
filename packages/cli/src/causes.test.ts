import { describe, expect, test } from 'vitest';
import { causes } from './causes.ts';

describe('causes', () => {
  test('one line per cause, first line only', () => {
    const error = new Error('Cannot read the config', {
      cause: new Error('ENOENT: no such file\nmore detail', { cause: new Error('deepest') }),
    });
    expect(causes(error)).toEqual(['  because: ENOENT: no such file', '  because: deepest']);
  });

  test('an empty message shows what it wraps, as for a refused connection on macOS', () => {
    const refused = new AggregateError(
      [
        new Error('connect ECONNREFUSED ::1:4600'),
        new Error('connect ECONNREFUSED 127.0.0.1:4600'),
      ],
      '',
    );
    const error = new Error('Cannot reach http://localhost:4600/.', {
      cause: new TypeError('fetch failed', { cause: refused }),
    });
    expect(causes(error)).toEqual([
      '  because: fetch failed',
      '  because: connect ECONNREFUSED ::1:4600; connect ECONNREFUSED 127.0.0.1:4600',
    ]);
  });

  test('an empty message with nothing inside shows its code, else its kind', () => {
    const reset = Object.assign(new Error(''), { code: 'ECONNRESET' });
    expect(causes(new Error('Lost', { cause: reset }))).toEqual(['  because: ECONNRESET']);
    expect(causes(new Error('Odd', { cause: new RangeError('') }))).toEqual([
      '  because: RangeError',
    ]);
  });
});
