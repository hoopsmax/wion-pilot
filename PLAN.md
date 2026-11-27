# Wion-Pilot v2: plan

> **First message for Claude Code:**
> Read CLAUDE.md and PLAN.md. We're starting Milestone 0. Before running anything, list the exact steps you'll take and every package you'll install, then wait for my OK.

## What it is

Wion-Pilot is an AI-assisted test automation platform for web apps. You point it at an app, and it maps the screens. Then you build tests three ways:

- write them in plain Gherkin,
- record them by clicking through the app,
- or let AI draft them for your approval.

Tests run on Playwright, and every failure produces a bug-report draft that you check before filing.

## Ground rules

- Written from scratch, on my own computer and my own time.
- No code, names, data, URLs or screenshots from any employer or private project.
- The demo app, **Sprout**, is fictional and uses made-up data only.
- v2 supports **web apps only**. Desktop apps are out of scope.

## Tech stack

| Area | Choice |
| --- | --- |
| Language | TypeScript (strict), current Node.js LTS, npm workspaces |
| E2E tests | Playwright Test + playwright-bdd (Gherkin) |
| Unit tests | Vitest |
| Demo app | Vite + React + TypeScript, small Express API, JSON-file storage |
| Offline mode | Service worker + IndexedDB outbox |
| AI providers | `none` (default), Ollama (local), Claude API (opt-in, key from `.env`) |
| CI | GitHub Actions; HTML report published to GitHub Pages |

## Repository layout

```
wion-pilot/
├─ CLAUDE.md
├─ PLAN.md
├─ README.md
├─ apps/
│  └─ sprout/               # demo app under test (web + API)
├─ packages/
│  ├─ core/src/
│  │  ├─ map/               # crawl a web app, build the app map
│  │  ├─ teach/             # record clicks, turn them into Gherkin steps
│  │  ├─ draft/             # AI providers, approval, cost ledger
│  │  ├─ report/            # bug-report drafts
│  │  └─ shared/            # config, logging, file store
│  └─ cli/                  # the `wion` command
├─ tests/
│  ├─ features/             # ONE FOLDER PER FEATURE
│  │  ├─ auth/              #   auth.feature + auth.steps.ts
│  │  ├─ plants/
│  │  ├─ watering-log/
│  │  └─ offline-sync/
│  ├─ steps/                # shared step library (navigation, forms, assertions)
│  ├─ pages/                # page objects, one per screen
│  └─ fixtures/             # test users, data builders, cleanup
├─ .wion/                   # app map, AI proposals, ledger (runtime output, gitignored)
├─ playwright.config.ts
└─ .github/workflows/ci.yml
```

## Demo app: Sprout (a plant-care tracker)

- **Screens:**
  - Sign in, with two demo users
  - Plant list, with search and filter
  - Add/edit plant form, with validation:
    - name is required
    - the watering interval must be 1–60 days
    - the light level is picked from a list
  - Plant detail, with a watering log (log a watering, add notes)
  - Settings
- **Offline mode:** the app keeps working without a connection. Changes go to an outbox and sync when the connection is back. A banner shows Offline / Syncing / Synced.
- **No silent data loss:** each plant has a version number. If two users edit the same plant, the second save shows a conflict screen. That user can keep their own change or take the latest.
- **Test support:** `npm run demo:reset` restores the seed data. A reset endpoint exists only in test mode.
- Some elements have `data-testid` and some don't, to show that role- and label-based locators work too.

## Milestones

Each milestone ends with:
- tests green locally and in CI
- README updated
- small commits with clear messages

Times are rough, for working with Claude Code.

### M0: Setup (half a day)

- Old repo: rename `Wion-Pilot` to `wion-pilot-v1` and keep it private, so the new repo can use the name.
- Create a new public repo `wion-pilot` with the MIT license.
- Check that `git config user.email` is the personal address before the first commit.
- Add Playwright MCP to Claude Code: `claude mcp add playwright npx @playwright/mcp@latest`
- Scaffold the project:
  - npm workspaces, strict TypeScript
  - ESLint + Prettier, Vitest
  - Playwright + playwright-bdd, then `npx playwright install`
- Scripts:
  - `npm run check`: lint, typecheck and unit tests
  - `npm test`: `bddgen` then `playwright test`
- CI: GitHub Actions runs `npm run check` on every push and pull request.

**Done when:** the empty project passes `npm run check`, both locally and in CI.

### M1: Sprout demo app (1 day)

Built in five small steps, each one approved first. The scope was narrowed to the two flows that are usually tested by hand: offline work and two people editing the same thing.

- **Built:**
  - API with JSON-file storage, seed data, `npm run demo:reset` and a test-mode reset endpoint
  - Screens: sign in (two demo users), plant list, add/edit form with validation
  - Offline outbox and sync, with an Offline / Syncing / Synced banner; sign out waits until everything is synced
  - Conflicts decided field by field: fields only one person changed are merged automatically, equal values are not a conflict, and only fields both changed to different values are shown side by side
  - `npm run demo` builds and starts the web app and the API on one address
- **Moved to later:** watering log, settings screen, search and filter, and the service worker (reloading the page while offline). Until the watering log exists, M2's `watering-log` feature waits.

**Done when:**
- you can add and edit plants
- you can go offline in the browser, keep working, come back online, and see everything sync
- editing the same field of a plant in two browsers shows the conflict screen with only that field

### M2: Hand-written BDD suite (1 day)

- **Shared step library:** navigation, forms, tables and assertions, written once and reused everywhere.
- **Page objects:** one per screen. Locators use roles, labels and test ids only.
- **Features** (built in four approved steps):
  - `auth`
  - `plants` (create, edit, validation). Delete waits until Sprout has a delete button.
  - `offline-sync`, which uses `context.setOffline()`
  - `conflict`, which uses two browser contexts as two users, including the field-by-field merge, offline edits, a conflict while typing, and a background refresh (fast-forwarded with Playwright's clock instead of a fixed wait)
  - `watering-log` waits until Sprout has the watering log (moved to later in M1).
- **Guard rails:** a lint rule makes step files fail when they use raw locators instead of page objects.
- **Test data:** each test creates its own data with a `wion-test-` prefix and cleans up after itself. Tests run in parallel.
- **CI:** start Sprout, run the suite, and upload the HTML report. On `main`, publish the report to GitHub Pages.

**Done when:** the suite passes 3 runs in a row, locally and in CI, with no fixed waits.

### M3: Bug-report drafts (half a day)

- A custom Playwright reporter. On a failure, it writes `reports/bugs/<scenario>.md` with:
  - steps to reproduce, taken from the Gherkin steps
  - expected and actual results
  - screenshot, video and trace
  - console errors and failed network requests
  - a link to the failing step in the `.feature` file
- Every draft is marked "DRAFT: verify before filing".
- **Built** in `packages/core/src/report/`: drafts are written to `reports/bugs/<feature>--<scenario>.md`; Background steps and two-browser tests (one screenshot per person) are covered; when Playwright's error states no expected and actual, the draft says so instead of guessing. `npm run demo:bug` runs a scenario that fails on purpose, and the "Bug-report demo" CI job checks its draft on every push. Example: `docs/example-bug-report.md`.

**Done when:** a deliberately broken test produces a complete draft.

### M4: Map an app (1 day)

- `wion map <url>` crawls same-origin pages from a start URL.
  - It has limits on pages and depth, and a domain allow-list.
  - It never clicks destructive controls (delete, remove, sign out, pay).
- For each screen it records:
  - URL, title and headings
  - forms and fields
  - buttons and links, with Playwright locators
  - a screenshot
- Output: `.wion/map/app-map.json`, plus an HTML viewer.

**Done when:** mapping Sprout finds every screen and every form field.

**Built (M4):**

- `wion map <url>` (`packages/cli`) with `--max-pages`, `--max-depth`, `--allow-domain`, `--out` and `--config`. The crawler and the viewer are in `packages/core/src/map/`.
- The sign-in comes from `wion.config.json`, with secrets from environment variables (`${SPROUT_PASSWORD}`). A wrong password is reported from the app's own alert, not after a timeout.
- Each route pattern is mapped once; two routes that show the same screen are one card with "also at".
- The `map` BDD feature checks every screen, field, locator and screenshot, and that no data changes. CI keeps the map as the `app-map` artifact.
- Sprout's conflict screen has no link, so a crawler cannot reach it. The README says so, and the `conflict` feature covers it.

### M5: AI drafts with approval (1 day)

- `wion draft "<what to test>"` sends the provider the app map and the shared step phrases. It does not send screenshots by default. The provider returns Gherkin scenarios that use only existing steps.
- Drafts go to `.wion/proposals/`. Nothing enters `tests/features/` until `wion review` approves it.
- Providers:
  - `none` prints the prompt so you can paste it into any chat
  - `ollama` uses a local model
  - `claude` is opt-in and needs an API key
- **Ledger:** every call is appended to `.wion/ledger.jsonl`, with provider, model, tokens, seconds and estimated cost.
- Secrets and personal data are redacted before anything is sent.

**Done when:** drafting "watering reminders" produces scenarios that `bddgen` accepts and that pass after approval.

**Built (M5):**

- Sprout got watering reminders first (last-watered day, "Water in 3 days" / "2 days overdue", a Watered button that works offline; the later watering day wins without a conflict), with a hand-written `reminders` feature, so the AI had real steps to use.
- `wion draft` by topic, by code change (`--diff <base>`), or both; with a code change the AI also writes what changed, a test plan and the steps it would need ("missing steps"). Providers: `none` (default), `ollama`, `claude` (Anthropic's SDK, Claude Opus 5.5). Redaction before sending; a 3-minute limit per call; every call, also a failed one, in the ledger.
- Our code writes the Gherkin and checks it with `bddgen` against the shared steps only; `wion review` approves scenario by scenario and checks again before writing.
- **The real run:** Claude drafted 13 scenarios from the reminders change (16,837 tokens in, 4,444 out, 55 s, about $0.16). All passed `bddgen` and were approved; when run, 11 passed and 2 failed, because they changed a field without opening the form. Kept: the 5 scenarios that were new (two fixed by hand, marked in the file). Lesson: the step list does not show step order, so the AI now sees the hand-written features as examples.

### M6: Teach mode (1 day)

- `wion teach <feature>` opens the app. You click through it, and each action becomes a Gherkin step from the shared step library, using names from the app map.
- The result is saved as a draft for review.

**Done when:** recording "add a plant" gives a scenario that runs green without edits.

**Built (M6):**

- Generic steps in the shared library (`Ava clicks "…"`, `fills "…" with "…"`, `chooses "…" in "…"`, `sees "…"`), by the names a person sees, with `{new name}` for one fresh `wion-test-…` name per scenario.
- The recorder (`packages/core/src/teach/`): a script in the page reports clicks, typing, list choices and Option/Alt+clicks (checks); passwords are never recorded; what cannot become a step becomes a note. Tested in a real browser in CI, with Playwright playing Ava.
- `wion teach <url> "<scenario>"`: a visible browser, signed in from `wion.config.json`; Enter finishes, Ctrl+C cancels; the recording goes through the `bddgen` check and `wion review` like an AI draft, tagged `@recorded`.
- **The real run:** recording "Adding a plant by clicking" on the maintainer's Mac runs green without edits (`tests/features/adding-a-plant-by-clicking/`). Two earlier takes taught three fixes: a note when typed text is not test data, review shows a recording's notes, and "wion test fern" with spaces counts as test data.
- Found on the way: the test cleanup could miss a plant that reached the server late (it now waits for sync), the recorder's stop could miss the last action, and Sprout waited 10 seconds to retry a failed sync right after reconnecting (now 1, 2, 4, 8 seconds).

### M7: Portfolio polish (ongoing)

- **README:**
  - a one-paragraph pitch and a 2-minute quickstart
  - a GIF of map, teach and draft
  - an architecture diagram
  - design decisions: why role locators, why plain JSON files, why an approval gate
  - an honest note on building it with Claude Code
- Badges for CI and the license, plus a link to the live report on GitHub Pages.
- **Resume and LinkedIn:** add Wion-Pilot only once M0–M3 are public and green.

**Built (M7, step 1):**

- The README is a front page: badges for CI, the license and the live report; a pitch; a quickstart; an architecture diagram (Mermaid, drawn by GitHub); five design decisions, each with what happened in this project; and a short note on how it was built.
- The detailed guides moved to `docs/`, one page per area: Sprout, the test suite, bug-report drafts, map, AI drafts and teach.

**Built (M7, step 2):**

- A GIF at the top of the README (`docs/media/wion-demo.gif`: 960×625, about 50 seconds, under 1 MB) shows real runs on the demo app:
  - `wion map`, then its viewer with the locators;
  - `wion teach` on a virtual screen, with Playwright playing the person in the command's own browser. It recorded the same seven steps as the maintainer's recording;
  - `wion draft` with Claude (5,840 in / 3,044 out tokens, about $0.08), then `wion review`, run on the maintainer's Mac so the key stayed there.
- The terminal windows are drawn from the commands' captured output. Only the prompt is drawn, and the home folder is shown as `~`. The GIF was made with ffmpeg, which is not a project dependency.

**Built (M7, step 3):**

- The text for the repository's "About" box: a description, the live report as its website, and ten topics. The maintainer sets it in GitHub's settings, because this cloud session may not change repository settings.
- A 1280×640 link preview image, built from two GIF frames, for Settings → General → Social preview. It is not kept in the repo.
- With this, M7 is done. Polish can continue as needed.

**Fixed after M7:**

- **The flaky conflict scenario** ("Ava edited offline while Ben edited online"):
  - **Cause:** the test's save step waited for the Save button to go. The app only renames it "Saving…", so the step ended before the change was queued, and Ava's change could reach the server before Ben's.
  - **Proof:** with the save slowed down on purpose, the old step failed 5 times out of 5, and the fixed step passed 5 times out of 5.
  - **The M6 retry fix:** in M6 the flake was put down to Sprout's slow retry. That fix still stands on its own, with its own scenario.
- **ECONNRESET in the tests' API calls:**
  - **Cause:** Node drops a request on a keep-alive connection that has been idle for 6 seconds, and Playwright's request client reuses such connections.
  - **Fix:** Sprout now keeps idle connections open for 65 seconds.
- **E2E failures in CI:** the job's log now shows each bug-report draft and what the page showed.
