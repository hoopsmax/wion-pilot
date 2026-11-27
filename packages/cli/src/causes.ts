/** The first line of an error's own message, trimmed. */
function firstLine(error: Error): string {
  return (error.message.split('\n')[0] ?? '').trim();
}

/**
 * What one error says. Some errors have an empty message and keep the real reasons inside: on
 * macOS a refused connection is an AggregateError with one ECONNREFUSED per address tried.
 */
function ownWords(error: Error): string {
  const message = firstLine(error);
  if (message !== '') return message;
  if (error instanceof AggregateError) {
    const inner = (error.errors as unknown[])
      .filter((one): one is Error => one instanceof Error)
      .map(firstLine)
      .filter((line) => line !== '');
    if (inner.length > 0) return inner.join('; ');
  }
  return (error as NodeJS.ErrnoException).code ?? error.name;
}

/** One line per cause, so a failure says what went wrong underneath, without a stack trace. */
export function causes(error: unknown): string[] {
  const lines: string[] = [];
  for (let cause = (error as Error).cause; cause instanceof Error; cause = cause.cause) {
    lines.push(`  because: ${ownWords(cause)}`);
  }
  return lines;
}
