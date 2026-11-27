# Bug-report drafts

[← Wion-Pilot](../README.md)

When a test fails, Wion-Pilot writes a draft bug report to `reports/bugs/<feature>--<scenario>.md`. A person checks it before filing it; every draft starts with **"DRAFT: verify before filing."** See [a real example](example-bug-report.md).

A draft contains:

- the steps to reproduce, taken from the Gherkin steps, each marked passed ✅, failing ❌ or not run
- a link to the `.feature` file and to the failing line
- expected and actual, read from Playwright's error; if the error states neither, the draft says so instead of guessing
- links to the screenshot, video and trace, and the command to open the trace
- the browser console errors and failed network requests of everyone in the test (Ava and Ben)
- the full error, and a "Notes" section for anything the reporter could not find out

Passing tests write nothing, and each run starts with an empty `reports/bugs/`. In CI the drafts of a failing run are attached as the `bug-report-drafts` artifact, and the "Bug-report demo" job checks on every push that `npm run demo:bug` still produces a complete draft.

The reporter lives in `packages/core/src/report/`, the first part of Wion-Pilot itself.
