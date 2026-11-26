import type { Environment } from '../shared/config.ts';

/** How many things were replaced; never what they were. */
export interface Replaced {
  emails: number;
  secrets: number;
}

export interface Redaction {
  text: string;
  replaced: Replaced;
}

const SECRET_NAME = /PASSWORD|TOKEN|KEY|SECRET/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Long runs of letters and digits (with - or _), like API keys and password hashes. */
const TOKEN_LIKE = /[A-Za-z0-9_-]{32,}/g;
/** Ids are long too, but say nothing secret, and the AI may need to tell them apart. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Values of environment variables whose names say they are secret, longest first. */
function secretValues(env: Environment): string[] {
  return Object.entries(env)
    .filter(([name, value]) => SECRET_NAME.test(name) && value !== undefined && value.length >= 4)
    .map(([, value]) => value ?? '')
    .sort((a, b) => b.length - a.length);
}

function isTokenLike(candidate: string): boolean {
  return /\d/.test(candidate) && /[A-Za-z]/.test(candidate) && !UUID.test(candidate);
}

/**
 * Removes secrets and personal data from text that leaves this computer: the values of secret
 * environment variables, email addresses, and anything that looks like a key or a hash.
 */
export function redact(text: string, env: Environment): Redaction {
  const replaced: Replaced = { emails: 0, secrets: 0 };
  let result = text;
  for (const value of secretValues(env)) {
    result = result.replace(new RegExp(escapeRegExp(value), 'g'), () => {
      replaced.secrets += 1;
      return '<secret>';
    });
  }
  result = result.replace(EMAIL, () => {
    replaced.emails += 1;
    return '<email>';
  });
  result = result.replace(TOKEN_LIKE, (candidate) => {
    if (!isTokenLike(candidate)) return candidate;
    replaced.secrets += 1;
    return '<secret>';
  });
  return { text: result, replaced };
}
