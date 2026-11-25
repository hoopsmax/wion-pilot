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
});
