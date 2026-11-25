#!/usr/bin/env node
import { parseCliArgs, USAGE, UsageError } from './args.ts';
import { CRAWL_DEFAULTS } from '../../core/src/map/crawler.ts';
import { runMap } from './map-command.ts';

/** The first line of each cause, so a failure says what went wrong underneath without a stack. */
function causes(error: unknown): string[] {
  const lines: string[] = [];
  for (let cause = (error as Error).cause; cause instanceof Error; cause = cause.cause) {
    lines.push(`  because: ${cause.message.split('\n')[0] ?? ''}`);
  }
  return lines;
}

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseCliArgs(argv, CRAWL_DEFAULTS);
    if (args.command === 'help') {
      console.log(USAGE);
      return 0;
    }
    await runMap(args, process.env, (line) => {
      console.log(line);
    });
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`wion: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    console.error([`wion: ${(error as Error).message}`, ...causes(error)].join('\n'));
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
