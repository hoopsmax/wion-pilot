# Wion-Pilot

AI-assisted test automation for web apps, built with TypeScript and Playwright.

You point Wion-Pilot at a web app, and it maps the screens. Then you build tests three ways: write them in plain Gherkin, record them by clicking through the app, or let AI draft them for your approval. Tests run on Playwright, and every failure produces a bug-report draft that you check before filing.

## Status

Milestone 0 (setup) of the [roadmap](PLAN.md). The project is an empty skeleton: strict TypeScript, ESLint and Prettier, Vitest, Playwright with playwright-bdd, and CI on GitHub Actions. The demo app, Sprout, comes next (M1), then the BDD test suite (M2).

Until the first tests exist, `npm run test:unit` and `npm test` pass when they find no tests. That switch is removed as soon as real tests land, so an empty run fails again.

## Requirements

- Node.js 26, the current LTS. The version is pinned in `.nvmrc`.

## Setup

```bash
nvm install
npm ci
npx playwright install
```

`nvm install` reads `.nvmrc` and switches to Node 26 (with fnm, use `fnm use`). `npx playwright install` downloads the browsers, once per machine.

## Commands

| Command | What it does |
| --- | --- |
| `npm run check` | Lint (ESLint and Prettier), typecheck and unit tests. Run it before every commit. |
| `npm run format` | Format all files with Prettier. |
| `npm test` | Generate the tests from the `.feature` files (`bddgen`), then run Playwright. |
| `npx playwright show-report` | Open the last HTML report. |

`npm run demo` and `npm run demo:reset` arrive with Sprout in M1.

Lint also enforces some of the test rules: no fixed waits (`waitForTimeout`), no XPath locators, and no source file over 300 lines.

## How it's built

The coding rules are in [CLAUDE.md](CLAUDE.md), and the roadmap and repository layout are in [PLAN.md](PLAN.md).

## License

MIT. See [LICENSE](LICENSE).
