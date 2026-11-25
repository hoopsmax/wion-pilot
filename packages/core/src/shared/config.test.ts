import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadConfig, parseConfig, resolveEnv } from './config.ts';

const sprout = JSON.stringify({
  map: {
    signIn: {
      url: '/sign-in',
      fields: { Email: 'ava@sprout.test', Password: '${SPROUT_PASSWORD}' },
      submit: 'Sign in',
    },
  },
});

describe('parseConfig', () => {
  test('reads the sign-in and takes the password from the environment', () => {
    expect(parseConfig(sprout, 'wion.config.json', { SPROUT_PASSWORD: 'secret' })).toEqual({
      map: {
        signIn: {
          url: '/sign-in',
          fields: { Email: 'ava@sprout.test', Password: 'secret' },
          submit: 'Sign in',
        },
      },
    });
  });

  test('a missing environment variable stops with a message that names it', () => {
    expect(() => parseConfig(sprout, 'wion.config.json', {})).toThrow(
      'wion.config.json: needs the environment variable SPROUT_PASSWORD',
    );
  });

  test('a config without a sign-in is fine', () => {
    expect(parseConfig('{}', 'wion.config.json', {})).toEqual({});
  });

  test.each([
    ['{ broken', /is not valid JSON/],
    ['"text"', /must contain a JSON object/],
    ['{"map":{"signIn":{"url":"/x","fields":{}}}}', /needs "url" and "submit"/],
    ['{"map":{"signIn":{"url":"/x","submit":"Go","fields":{"Email":1}}}}', /must map each field/],
  ])('a broken file is explained: %s', (text, message) => {
    expect(() => parseConfig(text, 'wion.config.json', {})).toThrow(message);
  });
});

describe('resolveEnv', () => {
  test('replaces every ${NAME} and keeps other text', () => {
    expect(resolveEnv('${A}-${B} and $C', { A: '1', B: '2' }, 'x')).toBe('1-2 and $C');
  });
});

describe('loadConfig', () => {
  test('no file is no config, unless the file was asked for', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'wion-config-'));
    const missing = join(folder, 'wion.config.json');
    try {
      expect(await loadConfig(missing, { required: false, env: {} })).toEqual({});
      await expect(loadConfig(missing, { required: true, env: {} })).rejects.toThrow(
        /Cannot read the config file/,
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
