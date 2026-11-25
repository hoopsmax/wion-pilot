// Terminal colour codes (ESC [ … m) that Playwright puts into its error messages.
const ANSI_COLOURS = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI_COLOURS, '');
}

export interface ExpectedActual {
  expected: string;
  actual: string;
}

function valueAfter(label: 'Expected' | 'Received', message: string): string | undefined {
  // Playwright writes "Expected: …", or a variant such as "Expected string: …" or "Expected pattern: …".
  const match = new RegExp(`^\\s*${label}(?: [a-z]+)?:\\s*(.*)$`, 'm').exec(message);
  return match?.[1]?.trim();
}

/**
 * Reads the diff that toEqual and similar matchers print: after "- Expected" / "+ Received", a line
 * starting with "-" is only in the expected value, "+" only in the received one, " " in both.
 */
function fromDiff(message: string): ExpectedActual | undefined {
  const lines = message.split('\n');
  const header = lines.findIndex((line) => /^- Expected\b/.test(line));
  if (header < 0 || !/^\+ Received\b/.test(lines[header + 1] ?? '')) return undefined;
  const body: string[] = [];
  for (const line of lines.slice(header + 3)) {
    if (line.trim() === '' || /^Call [Ll]og:/.test(line)) break;
    body.push(line);
  }
  const side = (keep: string) =>
    body
      .filter((line) => line.startsWith(keep) || line.startsWith(' '))
      .map((line) => line.slice(2))
      .join('\n');
  return body.length === 0 ? undefined : { expected: side('-'), actual: side('+') };
}

/**
 * Reads "Expected" and "Received" from a Playwright error. Returns nothing when the error does
 * not state both, so a draft never shows a made-up expectation.
 */
export function expectedAndActual(errorMessage: string): ExpectedActual | undefined {
  const message = stripAnsi(errorMessage);
  const expected = valueAfter('Expected', message);
  const actual = valueAfter('Received', message);
  if (expected !== undefined && actual !== undefined) return { expected, actual };
  return fromDiff(message);
}
