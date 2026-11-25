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
 * Reads "Expected" and "Received" from a Playwright error. Returns nothing when the error does
 * not state both, so a draft never shows a made-up expectation.
 */
export function expectedAndActual(errorMessage: string): ExpectedActual | undefined {
  const message = stripAnsi(errorMessage);
  const expected = valueAfter('Expected', message);
  const actual = valueAfter('Received', message);
  if (expected === undefined || actual === undefined) return undefined;
  return { expected, actual };
}
