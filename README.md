# Wion-Pilot

AI-assisted test automation for web apps, built with TypeScript and Playwright.

You point Wion-Pilot at a web app, and it maps the screens. Then you build tests three ways: write them in plain Gherkin, record them by clicking through the app, or let AI draft them for your approval. Tests run on Playwright, and every failure produces a bug-report draft that you check before filing.

## Status

Milestones 0 to 4 of the [roadmap](PLAN.md) are done:

- **M0:** the tooling (strict TypeScript, ESLint and Prettier, Vitest, Playwright with playwright-bdd, CI on GitHub Actions)
- **M1:** **Sprout**, the demo app that Wion-Pilot tests
- **M2:** a hand-written BDD suite that automates Sprout's hardest flows, run in CI on every push
- **M3:** a bug-report draft for every failing test ([example](docs/example-bug-report.md))
- **M4:** `wion map`, which maps an app's screens, form fields and locators

The latest test report from `main` is published at **https://hoopsmax.github.io/wion-pilot/**.

Next is M5: AI drafts of new scenarios, which a person approves before they are added.

## Sprout, the demo app

Sprout is a small, made-up plant-care app (`apps/sprout`). It exists to show flows that are often tested only by hand:

- **Offline mode.** Every change is saved in the browser first (an outbox in IndexedDB) and sent when the connection is there. A banner always says **Offline**, **Syncing** or **Synced**, and changes that have not reached the server show "Not synced yet".
- **Two people editing the same plant.** Each plant has a version number. When two edits meet, Sprout compares them field by field: fields only one person changed are combined automatically, and equal values are not a conflict. Only fields both people changed to different values are shown on a conflict screen, side by side ("Yours" and "Latest (Ben)"), for the user to choose.
- **Watering reminders.** Each plant says when to water it next, counted in calendar days from its last watering, and a **Watered** button starts the count again. Tests fix "today" with Playwright's clock.
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
| `npm run map:sprout` | Map the running Sprout (signed in as Ava) into `.wion/map/`. See [Map an app](#map-an-app). |
| `npm run wion -- map <url>` | Map any web app. `npm run wion -- --help` lists the options. |
| `npm run wion -- draft "<topic>"` | Let an AI draft scenarios for review. See [AI drafts](#ai-drafts). |
| `npm run wion -- review` | Approve or reject drafted scenarios, one by one. |
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

**Watering reminders**

Each plant says when it needs water next: "Water in 3 days", "Water tomorrow", "Water today" or "2 days overdue". **Watered** starts the count again from today, also offline. If two people water the same plant, the later day simply wins; it is never a conflict. A fresh demo (`npm run demo:reset`) always shows a mix, because the seed's waterings are moved to the current date.

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
| `reminders` | Each reminder wording, marking a plant watered (also offline), with "today" fixed by Playwright's clock so dates never flake. |
| `conflict` | Ava and Ben in two browsers: different fields are combined, equal values are no conflict, and only clashing fields are asked about, also after working offline or while typing. |
| `draft` | `wion draft` and `wion review` on saved answers: a good answer becomes a proposal, a made-up step is refused, only approved scenarios are written, and the prompt has personal data removed. |
| `map` | `wion map` finds every screen and form field of Sprout with a locator for each, changes no data, and explains a wrong password or an app that is not running. |

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

## Map an app

`wion map` opens an app's pages and writes down what a tester needs: every screen, its form fields and a Playwright locator for every button, link and field. Try it on Sprout:

```bash
npm run demo
```

Then, in a second terminal:

```bash
npm run map:sprout
open .wion/map/index.html
```

(On Linux, open the file in a browser instead of using `open`.) The run prints one line per screen and writes:

- `.wion/map/app-map.json`: the map, for tools and later milestones
- `.wion/map/index.html`: a viewer page, one card per screen
- `.wion/map/screens/`: a full-page screenshot of each screen

For each screen the map keeps the address and route pattern (`/plants/:id/edit`), the title and headings, the forms with each field's label, type and rules (required, min, max, options), the buttons, links and fields with a locator, and the `data-testid`s. An element without an accessible name gets no locator but a note: a screen reader user would miss it too.

**How it crawls**

- It signs in first, if `wion.config.json` says how: the fields by their label, the button by its name. Secrets stay out of the file: `${SPROUT_PASSWORD}` is read from the environment, and a missing variable stops the run with a message that names it. The sign-in screen itself is mapped before signing in.
- It then opens pages breadth-first by their address, within `--max-pages` (default 30) and `--max-depth` (default 3), and only on the start URL's own site unless `--allow-domain` adds another.
- It maps each route once: five "Edit" links are one screen, `/plants/:id/edit`. Two addresses that show exactly the same screen get one card that says "also at" (Sprout shows its plant list at `/` and `/plants`).
- **It never clicks, types or submits** apart from signing in, and it never opens links that look destructive (delete, remove, sign out, pay). The "Links not followed" list says why each was skipped. Mapping Sprout changes no data; the `map` feature checks that.
- Wrong use fails with a clear message: a wrong URL, an app that is not running ("Is the app running? For Sprout: npm run demo"), a missing password, or a sign-in error, quoted from the app's own alert.

**Known limit:** a crawler only finds screens that a link leads to. Sprout's conflict screen appears only while a conflict is waiting and has no link of its own, so it is not on the map. The `conflict` feature tests it instead.

In CI the "App map" job maps Sprout on every push and keeps the result as the `app-map` artifact. The code lives in `packages/core/src/map/` and the command in `packages/cli/`.

## AI drafts

`wion draft` asks an AI for new BDD scenarios; `wion review` lets a person approve them one by one. **Nothing enters `tests/features/` without that approval.**

```bash
npm run wion -- draft "watering reminders"                                # by topic
npm run wion -- draft --diff main --provider claude                       # from the code change since main
npm run wion -- draft "watering reminders" --diff main --provider claude  # both
npm run wion -- review
```

**What the AI gets:** the topic and/or the app's code change (`git diff`, files under `apps/` only), a short summary of the app map (screens, fields, buttons; no screenshots; run `npm run map:sprout` first for better drafts), the list of shared steps from `tests/steps/`, and one feature as a style example. With a code change it also explains in plain words what changed and writes a test plan.

**Before anything is sent**, the prompt is redacted: email addresses, the values of environment variables named like `PASSWORD`, `TOKEN`, `KEY` or `SECRET`, and long key- or hash-like strings become `<email>` / `<secret>`. The command says how many it removed.

**Providers** (one interface, `packages/core/src/draft/providers/`):

| Provider | What it does |
| --- | --- |
| `none` (default) | No AI call. Saves the prompt in `.wion/prompts/` to paste into any chat; bring the answer back with `--answer <file>`. |
| `ollama` | A local model through Ollama (`--model`, default `llama3.1`). Free; nothing leaves the computer. |
| `claude` | Opt-in. Claude Opus 5.5 by default (`--model` to change), through Anthropic's SDK. Needs `ANTHROPIC_API_KEY`: copy `.env.example` to `.env` and fill it in (`npm run wion` reads `.env`; git ignores it). |

**The answer is checked, never trusted:** the AI must answer with JSON in a fixed shape; our code writes the Gherkin; then `bddgen` checks it against the shared steps only. A made-up step fails the check and is named; such a draft is kept in `.wion/proposals/` with the reason but never offered for review. Steps the AI would need but that do not exist are listed as comments ("missing steps"), for a person to write.

**Review** shows each scenario of each passing proposal and asks: approve, reject, skip the proposal, or quit. Approved scenarios are checked again and written to `tests/features/<feature>/<feature>.feature` with a header saying who drafted them and when they were approved (or added to the end of an existing file; nothing is overwritten). Every drafted feature carries the `@ai-drafted` tag.

**Ledger:** every real AI call adds a line to `.wion/ledger.jsonl` with the provider, model, tokens, seconds and an estimated cost; the command prints the same.

## How it's built

The coding rules are in [CLAUDE.md](CLAUDE.md), and the roadmap and repository layout are in [PLAN.md](PLAN.md).

## License

MIT. See [LICENSE](LICENSE).
