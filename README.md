# Wion-Pilot

AI-assisted test automation for web apps, built with TypeScript and Playwright.

You point Wion-Pilot at a web app, and it maps the screens. Then you build tests three ways: write them in plain Gherkin, record them by clicking through the app, or let AI draft them for your approval. Tests run on Playwright, and every failure produces a bug-report draft that you check before filing.

## Status

Milestones 0 to 3 of the [roadmap](PLAN.md) are done:

- **M0:** the tooling (strict TypeScript, ESLint and Prettier, Vitest, Playwright with playwright-bdd, CI on GitHub Actions)
- **M1:** **Sprout**, the demo app that Wion-Pilot tests
- **M2:** a hand-written BDD suite that automates Sprout's hardest flows, run in CI on every push
- **M3:** a bug-report draft for every failing test ([example](docs/example-bug-report.md))

The latest test report from `main` is published at **https://hoopsmax.github.io/wion-pilot/**.

Next is M4: mapping an app's screens with `wion map`.

## Sprout, the demo app

Sprout is a small, made-up plant-care app (`apps/sprout`). It exists to show flows that are often tested only by hand:

- **Offline mode.** Every change is saved in the browser first (an outbox in IndexedDB) and sent when the connection is there. A banner always says **Offline**, **Syncing** or **Synced**, and changes that have not reached the server show "Not synced yet".
- **Two people editing the same plant.** Each plant has a version number. When two edits meet, Sprout compares them field by field: fields only one person changed are combined automatically, and equal values are not a conflict. Only fields both people changed to different values are shown on a conflict screen, side by side ("Yours" and "Latest (Ben)"), for the user to choose.
- **No silent data loss.** A change is never dropped: it waits in the outbox, or it waits for a decision. Signing out is blocked while changes are still waiting.

## Requirements

- Node.js 26, the current LTS. The version is pinned in `.nvmrc`.

## Setup

```bash
nvm install
npm ci
npx playwright install
```

`nvm install` reads `.nvmrc` and switches to Node 26 (with fnm, use `fnm use`). `npx playwright install` downloads the browsers, once per machine.

If your terminal says `nvm: command not found`, install nvm first (macOS with zsh shown; the nvm installer only adds itself to a shell settings file that already exists):

```bash
touch ~/.zshrc
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
```

Then close the terminal window, open a new one, and run the setup above.

## Commands

| Command | What it does |
| --- | --- |
| `npm run demo` | Build Sprout and start it at http://localhost:4600. |
| `npm run demo:reset` | Restore Sprout's seed data. Works while the demo is running. |
| `npm run demo:bug` | Run one scenario that fails on purpose and write its bug-report draft. npm reports a failure: that is the demo. |
| `npm run check` | Lint (ESLint and Prettier), typecheck and unit tests. Run it before every commit. |
| `npm run format` | Format all files with Prettier. |
| `npm test` | Generate the tests from the `.feature` files (`bddgen`), then run Playwright. |
| `npx playwright show-report` | Open the last HTML report. |

Lint also enforces some of the test rules: no fixed waits (`waitForTimeout`), no XPath locators, and no source file over 300 lines.

## Try Sprout

Start it with `npm run demo` and open http://localhost:4600. The two demo users are made up:

| User | Email | Password |
| --- | --- | --- |
| Ava | `ava@sprout.test` | `sprout-ava` |
| Ben | `ben@sprout.test` | `sprout-ben` |

**Offline mode**

1. Sign in as Ava. The banner says **Synced**.
2. Open the browser's DevTools, Network tab, and choose **Offline**. The banner says **Offline**.
3. Edit a plant or add one. It shows "Not synced yet", and Sign out is blocked.
4. Switch the network back to **No throttling**. The banner goes to **Syncing**, then **Synced**.

Reloading the page while offline is not supported yet (that needs a service worker, planned for later).

**A conflict**

1. Sign in as Ava in a normal window and as Ben in a private window.
2. Both open the same plant with **Edit**.
3. Ben changes the name and saves. Ava changes the name to something else and saves.
4. Ava sees the conflict screen with only the **Name** field. If they had changed different fields, both changes would simply be kept.

`npm run demo:reset` brings the seed data back at any time.

## The BDD test suite

The features are written in plain language (Gherkin) and run on Playwright:

| Feature | What it checks |
| --- | --- |
| `auth` | Signing in, a wrong password, signing out. |
| `plants` | Adding and editing a plant; the form explains each invalid field next to the field. |
| `offline-sync` | Changes made offline wait on the device ("Not synced yet", sign-out blocked) and reach the server when back online. |
| `conflict` | Ava and Ben in two browsers: different fields are combined, equal values are no conflict, and only clashing fields are asked about, also after working offline or while typing. |

Run them with `npm test`, then open the report with `npx playwright show-report`. The suite starts its own Sprout on port 4610 with its own data, so it never touches `npm run demo`.

How the tests are written (the rules are in [CLAUDE.md](CLAUDE.md)):

- **One folder per feature** in `tests/features/`, with its `.feature` file and its steps. Steps that several features use live in `tests/steps/`.
- **Steps talk to page objects** (`tests/pages/`), never to raw locators. A lint rule enforces this.
- **Locators by role, label, text or test id.** No XPath (also enforced by lint).
- **No fixed waits.** Every step waits for something its action caused, such as the form closing and then the banner saying "Synced".
- **Own test data:** each test creates plants named `wion-test-…` and deletes them afterwards, so tests run in parallel and in any order.
- **Failure evidence:** a failing test keeps a screenshot, a video and a trace. In CI the HTML report is attached to every run as the `playwright-report` artifact.

`PW_CHROMIUM_PATH` is only for sandboxes whose pre-installed browser belongs to another Playwright version; leave it unset on your machine.

## Bug-report drafts

When a test fails, Wion-Pilot writes a draft bug report to `reports/bugs/<feature>--<scenario>.md`. A person checks it before filing it; every draft starts with **"DRAFT: verify before filing."** See [a real example](docs/example-bug-report.md).

A draft contains:

- the steps to reproduce, taken from the Gherkin steps, each marked passed ✅, failing ❌ or not run
- a link to the `.feature` file and to the failing line
- expected and actual, read from Playwright's error; if the error states neither, the draft says so instead of guessing
- links to the screenshot, video and trace, and the command to open the trace
- the browser console errors and failed network requests of everyone in the test (Ava and Ben)
- the full error, and a "Notes" section for anything the reporter could not find out

Passing tests write nothing, and each run starts with an empty `reports/bugs/`. In CI the drafts of a failing run are attached as the `bug-report-drafts` artifact, and the "Bug-report demo" job checks on every push that `npm run demo:bug` still produces a complete draft.

The reporter lives in `packages/core/src/report/`, the first part of Wion-Pilot itself.

## How it's built

The coding rules are in [CLAUDE.md](CLAUDE.md), and the roadmap and repository layout are in [PLAN.md](PLAN.md).

## License

MIT. See [LICENSE](LICENSE).
