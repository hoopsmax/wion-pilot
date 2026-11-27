import { describe, expect, test } from 'vitest';
import { parseCliArgs, UsageError } from './args.ts';

const defaults = { maxPages: 30, maxDepth: 3 };

describe('parseCliArgs', () => {
  test('wion map <url> with the defaults', () => {
    expect(parseCliArgs(['map', 'http://localhost:4600'], defaults)).toEqual({
      command: 'map',
      startUrl: 'http://localhost:4600/',
      maxPages: 30,
      maxDepth: 3,
      allowedDomains: [],
      outDir: '.wion/map',
      configPath: undefined,
    });
  });

  test('every option', () => {
    const argv = [
      'map',
      'https://app.example.com/start',
      '--max-pages=5',
      '--max-depth',
      '2',
      '--allow-domain',
      'docs.example.com',
      '--allow-domain',
      'help.example.com',
      '--out',
      'out/map',
      '--config',
      'other.json',
    ];
    expect(parseCliArgs(argv, defaults)).toMatchObject({
      startUrl: 'https://app.example.com/start',
      maxPages: 5,
      maxDepth: 2,
      allowedDomains: ['docs.example.com', 'help.example.com'],
      outDir: 'out/map',
      configPath: 'other.json',
    });
  });

  test.each([[[]], [['--help']], [['map', '-h']]])('help: %j', (argv) => {
    expect(parseCliArgs(argv, defaults)).toEqual({ command: 'help' });
  });

  test.each([
    [['draw', 'http://x.test'], /Unknown command "draw"/],
    [['map'], /needs the URL/],
    [['map', 'localhost:4600'], /must start with http/],
    [['map', 'not a url'], /is not a URL/],
    [['map', 'http://x.test', 'extra'], /Unexpected arguments: extra/],
    [['map', 'http://x.test', '--max-pages', '0'], /--max-pages needs a whole number/],
    [['map', 'http://x.test', '--max-depth', 'two'], /--max-depth needs a whole number/],
    [['map', 'http://x.test', '--colour'], /Unknown option/],
  ])('wrong use is explained: %j', (argv, message) => {
    expect(() => parseCliArgs(argv, defaults)).toThrow(UsageError);
    expect(() => parseCliArgs(argv, defaults)).toThrow(message);
  });

  test('wion teach <url> <scenario name>, in several words or quoted', () => {
    expect(
      parseCliArgs(['teach', 'http://localhost:4600', 'Adding', 'a', 'plant'], defaults),
    ).toEqual({
      command: 'teach',
      startUrl: 'http://localhost:4600/',
      scenario: 'Adding a plant',
      feature: undefined,
      configPath: undefined,
      wionDir: '.wion',
      headless: false,
    });
    expect(
      parseCliArgs(
        ['teach', 'http://x.test', 'Adding a plant', '--feature', 'plants', '--headless'],
        defaults,
      ),
    ).toMatchObject({ scenario: 'Adding a plant', feature: 'plants', headless: true });
  });

  test.each([
    [['teach'], /needs the URL/],
    [['teach', 'http://x.test'], /needs a name for the scenario/],
    [
      ['teach', 'http://x.test', 'Add', '--feature', 'My Plants'],
      /--feature must be a folder name/,
    ],
  ])('wrong use of teach is explained: %j', (argv, message) => {
    expect(() => parseCliArgs(argv, defaults)).toThrow(message);
  });
});
