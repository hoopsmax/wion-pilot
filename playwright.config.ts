import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'tests/features/**/*.feature',
  steps: ['tests/steps/**/*.ts', 'tests/features/**/*.steps.ts', 'tests/fixtures/**/*.ts'],
});

// The suite runs its own Sprout on its own port and data file, so `npm run demo` and its
// data are never touched, and every run starts from the seed data.
const port = 4610;
const baseURL = `http://localhost:${String(port)}`;
const dataFile = join(import.meta.dirname, '.wion', 'e2e', 'sprout-db.json');

// Only for environments whose pre-installed browser belongs to another Playwright version
// (such as a cloud sandbox). Unset on a laptop and in CI, where `npx playwright install` is used.
const chromiumPath = process.env['PW_CHROMIUM_PATH'];

// The @demo-bug scenario fails on purpose; it runs only through `npm run demo:bug`.
const demoBug = process.env['WION_DEMO_BUG'] === '1';

export default defineConfig({
  testDir,
  ...(demoBug ? {} : { grepInvert: /@demo-bug/ }),
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  // No retries: a flaky test must fail visibly, not pass on a second try.
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // Writes reports/bugs/<feature>--<scenario>.md for every failing test.
    ['./packages/core/src/report/bug-report-reporter.ts'],
  ],
  use: {
    baseURL,
    // Evidence for failures, kept only when a test fails (used by M3's bug-report drafts).
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // A borrowed browser comes without the matching video recorder, so video is off there.
    video: chromiumPath ? 'off' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run demo:reset && npm run demo',
    url: baseURL,
    reuseExistingServer: false,
    env: { SPROUT_PORT: String(port), SPROUT_TEST_MODE: '1', SPROUT_DATA_FILE: dataFile },
  },
});
