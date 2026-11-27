# The BDD test suite

[← Wion-Pilot](../README.md)

The features are written in plain language (Gherkin) and run on Playwright:

| Feature | What it checks |
| --- | --- |
| `auth` | Signing in, a wrong password, signing out. |
| `plants` | Adding and editing a plant (also step by step, with the generic steps below); the form explains each invalid field next to the field. |
| `offline-sync` | Changes made offline wait on the device ("Not synced yet", sign-out blocked) and reach the server when back online. |
| `reminders` | Each reminder wording, marking a plant watered (also offline), with "today" fixed by Playwright's clock so dates never flake. |
| `watering-reminders` | Five scenarios drafted by Claude with `wion draft --diff main` and approved with `wion review` (two people watering, editing keeps the day, a new plant, sign-out blocked). Two needed a missing step added by hand; the file says which. |
| `conflict` | Ava and Ben in two browsers: different fields are combined, equal values are no conflict, and only clashing fields are asked about, also after working offline or while typing. |
| `adding-a-plant-by-clicking` | The first scenario recorded with `wion teach` (tagged `@recorded`), approved with `wion review`, unchanged since. |
| `teach` | The recorder in a real browser, with Playwright playing Ava: clicks, typing and checks become steps, the test name becomes `{new name}`, a password is never recorded; and the `wion teach` command itself. |
| `draft` | `wion draft` and `wion review` on saved answers: a good answer becomes a proposal, a made-up step is refused, only approved scenarios are written, and the prompt has personal data removed. |
| `map` | `wion map` finds every screen and form field of Sprout with a locator for each, changes no data, and explains a wrong password or an app that is not running. |

Run them with `npm test`, then open the report with `npx playwright show-report`. The suite starts its own Sprout on port 4610 with its own data, so it never touches `npm run demo`.

How the tests are written (the rules are in [CLAUDE.md](../CLAUDE.md)):

- **One folder per feature** in `tests/features/`, with its `.feature` file and its steps. Steps that several features use live in `tests/steps/`.
- **Steps talk to page objects** (`tests/pages/`), never to raw locators. A lint rule enforces this.
- **Locators by role, label, text or test id.** No XPath (also enforced by lint).
- **No fixed waits.** Every step waits for something its action caused, such as the form closing and then the banner saying "Synced".
- **Own test data:** each test creates plants named `wion-test-…` and deletes them afterwards, so tests run in parallel and in any order. Before deleting, a test waits until every online browser has sent its changes, so nothing reaches the server after the cleanup.
- **Generic steps** (`tests/steps/ui.steps.ts`), one per kind of action on any screen, by the names a person sees: `Ava clicks "Add plant"`, `Ava fills "Name" with "…"`, `Ava chooses "Medium light" in "Light"`, `Ava sees "…"`. Inside them, `"{new name}"` stands for one fresh `wion-test-…` name per scenario, deleted afterwards. Recorded scenarios (M6) are written with these steps.
- **Failure evidence:** a failing test keeps a screenshot, a video and a trace. In CI the HTML report is attached to every run as the `playwright-report` artifact.

`PW_CHROMIUM_PATH` is only for sandboxes whose pre-installed browser belongs to another Playwright version; leave it unset on your machine.
