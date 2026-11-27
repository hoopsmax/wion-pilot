import { parseArgs, type ParseArgsConfig } from 'node:util';

export const USAGE = `Usage:
  wion map <url> [options]            Map a web app's screens, fields and locators
  wion draft [topic] [options]        Let an AI draft BDD scenarios for review
  wion review [options]               Approve or reject drafted scenarios
  wion teach <url> "<scenario>"       Record a scenario by clicking through the app

wion map: opens pages by their address and never clicks or submits, apart from signing in.
  --max-pages <n>       Open at most n pages (default 30)
  --max-depth <n>       Follow links at most n steps from the start (default 3)
  --allow-domain <host> Also follow links to this host (repeat for more)
  --out <folder>        Where to write the map (default .wion/map)
  --config <file>       Sign-in settings (default wion.config.json, if it exists)

wion draft: give a topic, a code change, or both. Nothing enters tests/features without review.
  --diff <base>         Draft from the app's code change since <base> (a branch or commit)
  --provider <name>     none (default: prints the prompt), ollama or claude
  --model <name>        The model (claude: claude-opus-5-5; ollama: llama3.1)
  --answer <file>       Use an answer pasted from a chat instead of calling a provider

wion review:
  --features-dir <dir>  Where approved scenarios go (default tests/features)

wion teach: a browser opens, signed in. Click as usual; Option/Alt+click a text to check it;
name new things wion-test-…; press Enter in the terminal to finish (Ctrl+C cancels).
  --feature <folder>    The feature folder for the scenario (default: from its name)
  --config <file>       Sign-in and teach settings (default wion.config.json)
  --headless            No browser window (for tests)

wion draft, review and teach:
  --wion-dir <dir>      Where the map, prompts, proposals and ledger are (default .wion)

  -h, --help            Show this help

Examples:
  SPROUT_PASSWORD=sprout-ava wion map http://localhost:4600
  wion draft "watering reminders" --diff main --provider claude
  wion review
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

export const PROVIDERS = ['none', 'ollama', 'claude'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export interface DraftArgs {
  command: 'draft';
  topic: string | undefined;
  diffBase: string | undefined;
  provider: ProviderName;
  model: string | undefined;
  answerFile: string | undefined;
  /** Where wion keeps its map, prompts, proposals and ledger (default .wion). */
  wionDir: string;
}

export interface ReviewArgs {
  command: 'review';
  featuresDir: string;
  wionDir: string;
}

export interface TeachArgs {
  command: 'teach';
  startUrl: string;
  /** The scenario's name, for example "Adding a plant by clicking". */
  scenario: string;
  /** The feature folder; undefined to name it after the scenario. */
  feature: string | undefined;
  configPath: string | undefined;
  wionDir: string;
  headless: boolean;
}

export type CliArgs = { command: 'help' } | MapArgs | DraftArgs | ReviewArgs | TeachArgs;

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

const MAP_OPTIONS = {
  'max-pages': { type: 'string' },
  'max-depth': { type: 'string' },
  'allow-domain': { type: 'string', multiple: true },
  out: { type: 'string' },
  config: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

const DRAFT_OPTIONS = {
  diff: { type: 'string' },
  provider: { type: 'string' },
  model: { type: 'string' },
  answer: { type: 'string' },
  'wion-dir': { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

const REVIEW_OPTIONS = {
  'features-dir': { type: 'string' },
  'wion-dir': { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const;

const TEACH_OPTIONS = {
  feature: { type: 'string' },
  config: { type: 'string' },
  'wion-dir': { type: 'string' },
  headless: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

/** Node's parseArgs, with its errors turned into usage errors. */
function parse<T extends ParseArgsConfig>(config: T): ReturnType<typeof parseArgs<T>> {
  try {
    return parseArgs(config);
  } catch (error) {
    throw new UsageError((error as Error).message, { cause: error });
  }
}

function mapArgs(
  argv: string[],
  defaults: { maxPages: number; maxDepth: number },
): MapArgs | { command: 'help' } {
  const { values, positionals } = parse({
    args: argv,
    options: MAP_OPTIONS,
    allowPositionals: true,
  });
  if (values.help) return { command: 'help' };
  const [url, ...extra] = positionals;
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

function providerName(value: string | undefined): ProviderName {
  if (value === undefined) return 'none';
  const known = PROVIDERS.find((name) => name === value);
  if (!known) throw new UsageError(`Unknown provider "${value}". Use ${PROVIDERS.join(', ')}.`);
  return known;
}

function draftArgs(argv: string[]): DraftArgs | { command: 'help' } {
  const { values, positionals } = parse({
    args: argv,
    options: DRAFT_OPTIONS,
    allowPositionals: true,
  });
  if (values.help) return { command: 'help' };
  // A topic of several words works with or without quotes.
  const topic = positionals.join(' ').trim() || undefined;
  const provider = providerName(values.provider);
  if (values.answer !== undefined && provider !== 'none') {
    throw new UsageError('--answer replaces the provider call; leave out --provider.');
  }
  if (topic === undefined && values.diff === undefined && values.answer === undefined) {
    throw new UsageError('wion draft needs a topic, --diff <base>, or both.');
  }
  return {
    command: 'draft',
    topic,
    diffBase: values.diff,
    provider,
    model: values.model,
    answerFile: values.answer,
    wionDir: values['wion-dir'] ?? '.wion',
  };
}

function reviewArgs(argv: string[]): ReviewArgs | { command: 'help' } {
  const { values, positionals } = parse({
    args: argv,
    options: REVIEW_OPTIONS,
    allowPositionals: true,
  });
  if (values.help) return { command: 'help' };
  if (positionals.length > 0)
    throw new UsageError(`Unexpected arguments: ${positionals.join(' ')}.`);
  return {
    command: 'review',
    featuresDir: values['features-dir'] ?? 'tests/features',
    wionDir: values['wion-dir'] ?? '.wion',
  };
}

function teachArgs(argv: string[]): TeachArgs | { command: 'help' } {
  const { values, positionals } = parse({
    args: argv,
    options: TEACH_OPTIONS,
    allowPositionals: true,
  });
  if (values.help) return { command: 'help' };
  const [url, ...words] = positionals;
  if (url === undefined) throw new UsageError('wion teach needs the URL of the app to record in.');
  // A name of several words works with or without quotes.
  const scenario = words.join(' ').trim();
  if (scenario === '') {
    throw new UsageError(
      'wion teach needs a name for the scenario, like "Adding a plant by clicking".',
    );
  }
  const feature = values.feature;
  if (feature !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(feature)) {
    throw new UsageError(
      `--feature must be a folder name in kebab-case, like "plants", not "${feature}".`,
    );
  }
  return {
    command: 'teach',
    startUrl: httpUrl(url),
    scenario,
    feature,
    configPath: values.config,
    wionDir: values['wion-dir'] ?? '.wion',
    headless: values.headless ?? false,
  };
}

/** Turns the command line into what to do; wrong use throws a UsageError that says what is wrong. */
export function parseCliArgs(
  argv: string[],
  defaults: { maxPages: number; maxDepth: number },
): CliArgs {
  const [command, ...rest] = argv;
  if (command === undefined || command === '--help' || command === '-h') return { command: 'help' };
  if (command === 'map') return mapArgs(rest, defaults);
  if (command === 'draft') return draftArgs(rest);
  if (command === 'review') return reviewArgs(rest);
  if (command === 'teach') return teachArgs(rest);
  throw new UsageError(`Unknown command "${command}".`);
}
