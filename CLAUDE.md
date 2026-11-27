# CLAUDE.md: Wion-Pilot

## Project

Wion-Pilot is an AI-assisted test automation platform for web apps, built with TypeScript and Playwright. The roadmap is in PLAN.md. Work on one milestone at a time.

## Ground rules

- Everything here is written from scratch. Never add code, names, data, URLs or screenshots from an employer or any private project.
- The demo app, Sprout, is fictional. Use made-up data only.
- Ask before adding a dependency. Prefer what is already installed.
- Never commit secrets. `.env` stays gitignored, and keys come from environment variables.
- Before the first commit of a session, check that `git config user.email` is the personal address.

## Code style

- TypeScript strict mode, ESM, current Node.js LTS.
- **DRY:** search for an existing helper before writing a new one. If logic appears twice, extract it.
- **Small, reusable functions:** each one does one job and is named for what it does.
- **Modules by area:** `map/`, `teach/`, `draft/`, `report/`, `shared/`. No catch-all `utils.ts`. Keep files under about 300 lines, and split them when they grow.
- Comments explain why, not what. No commented-out code.
- Fail loudly, with a clear message. Never swallow errors.

## Features and tests

- **One folder per feature:** `tests/features/<feature>/` holds `<feature>.feature` and `<feature>.steps.ts`.
- Feature files describe behavior in plain language (Given/When/Then). No selectors or code in Gherkin.
- **Reuse steps:** check the shared step library in `tests/steps/` before writing a new step. Generic steps go there, not in a feature folder.
- **Page objects** live in `tests/pages/`, one per screen. Steps call page objects, never raw locators.
- **Locators:** `getByRole`, `getByLabel`, `getByText`, `getByTestId`. No XPath. Use CSS only with a comment that explains why.
- No fixed waits (`waitForTimeout`). Use web-first assertions.
- **Test data:** each test creates its own data with the prefix `wion-test-` and cleans up after itself. Tests must pass in parallel and in any order.
- Every core module has Vitest unit tests.

## AI features

- AI providers sit behind one interface. The default provider is `none`.
- Nothing AI-generated enters `tests/features/` without human approval through `wion review`.
- Every AI call is logged to `.wion/ledger.jsonl` with provider, model, tokens and seconds.
- Never send secrets or personal data to a provider. Redact before sending.

## Workflow

- For anything bigger than a small fix, write a short plan first and wait for my OK.
- Run `npm run check` before every commit, and `npm test` before pushing.
- Make small commits with clear messages that say what changed and why.
- Update README.md, and the matching page in `docs/`, whenever setup or behavior changes.
- When a milestone is done, show me what changed and how to verify it.

## Commands

- `npm run demo`: start Sprout (web app and API)
- `npm run demo:reset`: restore the seed data
- `npm run check`: lint, typecheck and unit tests
- `npm test`: generate the BDD tests, then run Playwright
- `npx playwright show-report`: open the last report
