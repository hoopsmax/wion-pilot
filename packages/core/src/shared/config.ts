import { readFile } from 'node:fs/promises';

/** How `wion map` signs in: fields found by their label, the button by its name. */
export interface SignInConfig {
  /** The sign-in page, relative to the app's start URL (for example "/sign-in"). */
  url: string;
  /** Label → value. Values may use ${NAME} to take an environment variable, for passwords. */
  fields: Record<string, string>;
  /** The accessible name of the button that signs in. */
  submit: string;
}

/** How `wion teach` writes recorded scenarios. */
export interface TeachConfig {
  /** The one-word name the steps use for the person, for example "Ava". */
  person: string;
  /** Steps that set the scene before the recording, without "Given", e.g. "Ava is signed in". */
  given: string[];
}

export interface WionConfig {
  map?: { signIn?: SignInConfig };
  teach?: TeachConfig;
}

export type Environment = Record<string, string | undefined>;

function fail(source: string, problem: string): never {
  throw new Error(`${source}: ${problem}`);
}

/** Replaces ${NAME} with the environment variable NAME; a missing one stops with a clear message. */
export function resolveEnv(value: string, env: Environment, source: string): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    const resolved = env[name];
    if (resolved === undefined || resolved === '') {
      fail(source, `needs the environment variable ${name}. Set it before running wion.`);
    }
    return resolved;
  });
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}

function readSignIn(raw: unknown, env: Environment, source: string): SignInConfig {
  const signIn = raw as Partial<SignInConfig>;
  if (typeof signIn.url !== 'string' || typeof signIn.submit !== 'string') {
    fail(source, 'map.signIn needs "url" and "submit" as text.');
  }
  if (!isStringRecord(signIn.fields)) {
    fail(source, 'map.signIn.fields must map each field label to a text value.');
  }
  const fields = Object.fromEntries(
    Object.entries(signIn.fields).map(([label, value]) => [label, resolveEnv(value, env, source)]),
  );
  return { url: signIn.url, fields, submit: signIn.submit };
}

function readTeach(raw: unknown, source: string): TeachConfig {
  const teach = raw as Partial<Record<keyof TeachConfig, unknown>>;
  if (typeof teach.person !== 'string' || !/^\S+$/.test(teach.person)) {
    fail(source, 'teach.person must be one word: the name the steps use, like "Ava".');
  }
  const given = teach.given ?? [];
  const isStepList =
    Array.isArray(given) &&
    given.every((step) => typeof step === 'string' && !/^(Given|When|Then|And|But)\b/.test(step));
  if (!isStepList) {
    fail(source, 'teach.given must be a list of steps without "Given", like ["Ava is signed in"].');
  }
  return { person: teach.person, given: given as string[] };
}

/** Reads the config text; every problem names the file and what to fix. */
export function parseConfig(text: string, source: string, env: Environment): WionConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    fail(source, `is not valid JSON (${String(error)}).`);
  }
  if (typeof raw !== 'object' || raw === null) fail(source, 'must contain a JSON object.');
  const config: WionConfig = {};
  const { map, teach } = raw as { map?: unknown; teach?: unknown };
  if (map !== undefined) {
    const signIn = (map as { signIn?: unknown }).signIn;
    config.map = signIn === undefined ? {} : { signIn: readSignIn(signIn, env, source) };
  }
  if (teach !== undefined) config.teach = readTeach(teach, source);
  return config;
}

/** Loads a config file. Without a file there is simply no config, unless the file was asked for. */
export async function loadConfig(
  path: string,
  { required, env }: { required: boolean; env: Environment },
): Promise<WionConfig> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (!required && (error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`Cannot read the config file ${path}.`, { cause: error });
  }
  return parseConfig(text, path, env);
}
