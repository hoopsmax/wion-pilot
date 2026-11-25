# Wion-Pilot

AI-assisted test automation for web apps, built with TypeScript and Playwright.

You point Wion-Pilot at a web app, and it maps the screens. Then you build tests three ways: write them in plain Gherkin, record them by clicking through the app, or let AI draft them for your approval. Tests run on Playwright, and every failure produces a bug-report draft that you check before filing.

## Status

Milestones 0 and 1 of the [roadmap](PLAN.md) are done: the tooling (strict TypeScript, ESLint and Prettier, Vitest, Playwright with playwright-bdd, CI on GitHub Actions) and **Sprout**, the demo app that Wion-Pilot tests. Next is M2, the BDD test suite.

M2 is in progress: the first BDD feature (`tests/features/auth`) runs with `npm test`. It starts its own Sprout on port 4610 with its own data, so it never touches `npm run demo`.

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

## How it's built

The coding rules are in [CLAUDE.md](CLAUDE.md), and the roadmap and repository layout are in [PLAN.md](PLAN.md).

## License

MIT. See [LICENSE](LICENSE).
