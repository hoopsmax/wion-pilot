#!/usr/bin/env node
import { parseCliArgs, USAGE, UsageError } from './args.ts';
import { causes } from './causes.ts';
import { CRAWL_DEFAULTS } from '../../core/src/map/crawler.ts';
import { runDraft } from './draft-command.ts';
import { runMap } from './map-command.ts';
import { runReviewInTerminal } from './review-command.ts';
import { runTeach } from './teach-command.ts';

async function main(argv: string[]): Promise<number> {
  try {
    const args = parseCliArgs(argv, CRAWL_DEFAULTS);
    if (args.command === 'help') {
      console.log(USAGE);
      return 0;
    }
    const log = (line: string) => {
      console.log(line);
    };
    if (args.command === 'map') {
      await runMap(args, process.env, log);
      return 0;
    }
    if (args.command === 'draft') {
      return await runDraft(args, {
        root: process.cwd(),
        env: process.env,
        now: () => new Date(),
        log,
      });
    }
    if (args.command === 'teach') {
      return await runTeach(args, {
        root: process.cwd(),
        env: process.env,
        now: () => new Date(),
        log,
      });
    }
    return await runReviewInTerminal(args, { root: process.cwd(), now: () => new Date(), log });
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`wion: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    console.error([`wion: ${(error as Error).message}`, ...causes(error)].join('\n'));
    return 1;
  }
}

/**
 * Keys such as ANTHROPIC_API_KEY can live in .env, which git ignores. Variables already set win;
 * no .env is normal and says nothing.
 */
function loadDotEnv(): void {
  try {
    process.loadEnvFile('.env');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

loadDotEnv();
process.exitCode = await main(process.argv.slice(2));
