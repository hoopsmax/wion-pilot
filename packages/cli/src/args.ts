import { parseArgs } from 'node:util';

export const USAGE = `Usage: wion map <url> [options]

Maps a web app: its screens, forms, buttons and links, with a Playwright locator for each.
It opens pages by their address and never clicks or submits, apart from signing in.

Options:
  --max-pages <n>       Open at most n pages (default 30)
  --max-depth <n>       Follow links at most n steps from the start (default 3)
  --allow-domain <host> Also follow links to this host (repeat for more)
  --out <folder>        Where to write the map (default .wion/map)
  --config <file>       Sign-in settings (default wion.config.json, if it exists)
  -h, --help            Show this help

Example:
  SPROUT_PASSWORD=sprout-ava wion map http://localhost:4600
`;

/** Wrong use of the command: the message is shown together with the usage. */
export class UsageError extends Error {}

export interface MapArgs {
  command: 'map';
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  allowedDomains: string[];
  outDir: string;
  /** undefined when --config was not given: then the default file is read only if it exists. */
  configPath: string | undefined;
}

export type CliArgs = { command: 'help' } | MapArgs;

export const DEFAULT_CONFIG = 'wion.config.json';

function positiveInteger(value: string | undefined, option: string, fallback: number): number {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new UsageError(`${option} needs a whole number of 1 or more, not "${value}".`);
  }
  return number;
}

function httpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UsageError(
      `"${value}" is not a URL. Give the full address, like http://localhost:4600`,
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UsageError(`The URL must start with http:// or https://, not "${url.protocol}".`);
  }
  return url.href;
}

const OPTIONS = {
  'max-pages': { type: 'string' },
  'max-depth': { type: 'string' },
  'allow-domain': { type: 'string', multiple: true },
  out: { type: 'string' },
  config: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

/** Turns the command line into what to do; wrong use throws a UsageError that says what is wrong. */
export function parseCliArgs(
  argv: string[],
  defaults: { maxPages: number; maxDepth: number },
): CliArgs {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    throw new UsageError((error as Error).message, { cause: error });
  }
  const { values, positionals } = parsed;
  if (values.help || positionals.length === 0) return { command: 'help' };
  const [command, url, ...extra] = positionals;
  if (command !== 'map') throw new UsageError(`Unknown command "${String(command)}".`);
  if (url === undefined) throw new UsageError('wion map needs the URL of the app to map.');
  if (extra.length > 0) throw new UsageError(`Unexpected arguments: ${extra.join(' ')}.`);
  return {
    command: 'map',
    startUrl: httpUrl(url),
    maxPages: positiveInteger(values['max-pages'], '--max-pages', defaults.maxPages),
    maxDepth: positiveInteger(values['max-depth'], '--max-depth', defaults.maxDepth),
    allowedDomains: values['allow-domain'] ?? [],
    outDir: values.out ?? '.wion/map',
    configPath: values.config,
  };
}
