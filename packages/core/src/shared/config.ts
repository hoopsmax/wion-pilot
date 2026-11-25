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

export interface WionConfig {
  map?: { signIn?: SignInConfig };
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

/** Reads the config text; every problem names the file and what to fix. */
export function parseConfig(text: string, source: string, env: Environment): WionConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    fail(source, `is not valid JSON (${String(error)}).`);
  }
  if (typeof raw !== 'object' || raw === null) fail(source, 'must contain a JSON object.');
  const map = (raw as { map?: unknown }).map;
  if (map === undefined) return {};
  const signIn = (map as { signIn?: unknown }).signIn;
  return signIn === undefined ? { map: {} } : { map: { signIn: readSignIn(signIn, env, source) } };
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
