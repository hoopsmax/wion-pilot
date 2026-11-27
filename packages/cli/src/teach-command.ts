import { createInterface } from 'node:readline';
import { chromium, type Page } from '@playwright/test';
import type { DraftAnswer } from '../../core/src/draft/answer.ts';
import { checkDraft } from '../../core/src/draft/check.ts';
import { TEACH_PROVIDER, toGherkin } from '../../core/src/draft/gherkin.ts';
import { saveProposal } from '../../core/src/draft/proposals.ts';
import { loadConfig, type Environment, type TeachConfig } from '../../core/src/shared/config.ts';
import { openAndSignIn } from '../../core/src/shared/sign-in.ts';
import { startRecording } from '../../core/src/teach/recorder.ts';
import { stepsFor } from '../../core/src/teach/steps.ts';
import { DEFAULT_CONFIG, type TeachArgs } from './args.ts';
import { wionPaths } from './draft-command.ts';
import { assertReachable } from './reachable.ts';

export interface TeachIo {
  root: string;
  env: Environment;
  now: () => Date;
  log: (line: string) => void;
}

/** "Adding a plant by clicking" → "adding-a-plant-by-clicking", the feature folder's name. */
export function featureFolder(scenario: string): string {
  const folder = scenario
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (folder === '') throw new Error(`"${scenario}" has no letters or digits to name a folder.`);
  return folder;
}

type Ending = 'done' | 'cancelled';

interface Finish {
  /** Settles when the person is done: Enter, the window closed, or Ctrl+C (cancelled). */
  ending: Promise<Ending>;
  /** Gives the terminal back: closes the input and removes the Ctrl+C handler. */
  release(): void;
}

/**
 * Starts listening for the end of a recording: Enter in the terminal, or closing the browser
 * window; Ctrl+C cancels. Called before the instructions are printed, so even a very quick
 * Ctrl+C is handled here, and the browser is always closed by wion.
 */
function listenForFinish(page: Page): Finish {
  const input = createInterface({ input: process.stdin, terminal: false });
  let onSigint: (() => void) | undefined;
  const ending = Promise.race<Ending>([
    new Promise<Ending>((resolve) => {
      input.once('line', () => {
        resolve('done');
      });
      // The input ended (Ctrl+D, or a pipe ran dry): that also means done.
      input.once('close', () => {
        resolve('done');
      });
    }),
    new Promise<Ending>((resolve) => {
      page.once('close', () => {
        resolve('done');
      });
    }),
    new Promise<Ending>((resolve) => {
      onSigint = () => {
        resolve('cancelled');
      };
      process.once('SIGINT', onSigint);
    }),
  ]);
  return {
    ending,
    release() {
      if (onSigint) process.off('SIGINT', onSigint);
      input.close();
    },
  };
}

function teachConfigOf(config: { teach?: TeachConfig }, file: string): TeachConfig {
  if (!config.teach) {
    throw new Error(
      `${file} needs a "teach" section, for example: "teach": { "person": "Ava", "given": ["Ava is signed in"] }`,
    );
  }
  return config.teach;
}

/** The recording as an answer, so proposals, the bddgen check and wion review work unchanged. */
function recordedAnswer(args: TeachArgs, steps: string[], notes: string[]): DraftAnswer {
  const description = [
    'Recorded with wion teach: a person clicked through the app.',
    ...(notes.length > 0
      ? ['', 'Notes from the recording:', ...notes.map((note) => `- ${note}`)]
      : []),
  ].join('\n');
  return {
    feature: args.feature ?? featureFolder(args.scenario),
    title: args.scenario,
    description,
    changeSummary: '',
    testPlan: [],
    scenarios: [{ name: args.scenario, steps }],
    missingSteps: [],
  };
}

/** Records one scenario in a browser and saves it as a proposal for wion review. */
export async function runTeach(args: TeachArgs, io: TeachIo): Promise<number> {
  const configFile = args.configPath ?? DEFAULT_CONFIG;
  const config = await loadConfig(configFile, {
    required: args.configPath !== undefined,
    env: io.env,
  });
  const teach = teachConfigOf(config, configFile);
  await assertReachable(args.startUrl);

  const chromiumPath = io.env['PW_CHROMIUM_PATH'];
  const browser = await chromium.launch({
    headless: args.headless,
    // wion handles Ctrl+C itself (see untilFinished): it closes the browser and says so.
    handleSIGINT: false,
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  });
  let ending: Ending;
  let actions;
  try {
    // No fixed viewport: the window behaves like a normal browser window.
    const page = await (await browser.newContext({ viewport: null })).newPage();
    const signIn = config.map?.signIn;
    if (signIn) {
      await openAndSignIn(page, args.startUrl, signIn);
      io.log(`Signed in at ${signIn.url}, as ${teach.person}.`);
    } else {
      await page.goto(args.startUrl, { waitUntil: 'networkidle' });
    }
    const recording = await startRecording(page);
    const finish = listenForFinish(page);
    io.log(`Recording "${args.scenario}". In the browser:`);
    io.log('  - click through the app as usual;');
    io.log('  - Option+click (Alt+click) a text to check that it is shown;');
    io.log('  - name anything new "wion test …" or wion-test-… (a fresh name in every test run).');
    io.log('Press Enter here when you are done, or Ctrl+C to cancel.');
    try {
      ending = await finish.ending;
    } finally {
      finish.release();
    }
    actions = await recording.stop();
  } finally {
    await browser.close();
  }
  if (ending === 'cancelled') {
    io.log('Cancelled: nothing was saved.');
    return 130;
  }

  const { steps, notes } = stepsFor(actions, { person: teach.person, given: teach.given });
  const now = io.now();
  const answer = recordedAnswer(args, steps, notes);
  const origin = {
    provider: TEACH_PROVIDER,
    model: 'recording',
    date: now.toISOString().slice(0, 10),
  };
  const featureText = toGherkin(answer, origin);
  const check = await checkDraft(io.root, featureText);
  const saved = await saveProposal(wionPaths(io.root, args.wionDir).proposals, featureText, {
    feature: answer.feature,
    title: answer.title,
    provider: TEACH_PROVIDER,
    model: 'recording',
    topic: args.scenario,
    diffBase: undefined,
    createdAt: now.toISOString(),
    check,
    answer,
  });

  io.log('');
  io.log(`Scenario: ${args.scenario}`);
  for (const step of steps) io.log(`  ${step}`);
  for (const note of notes) io.log(`Note: ${note}`);
  io.log(`Proposal: ${saved.featureFile}${saved.replaced ? ' (replaces the earlier one)' : ''}`);
  if (!check.ok) {
    io.log('It FAILED the check, so review will not offer it:');
    for (const problem of check.problems) io.log(`  ${problem}`);
    return 1;
  }
  io.log('It passed the check. Next: npm run wion -- review');
  return 0;
}
