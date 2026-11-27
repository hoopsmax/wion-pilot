# Teach mode

[← Wion-Pilot](../README.md)

`wion teach` writes a scenario while you click through the app. No AI, no cost.

```bash
npm run demo
```

Then, in a second terminal:

```bash
npm run teach:sprout -- "Adding a plant by clicking"
npm run wion -- review
```

A Chromium window opens, already signed in (with `map.signIn` from `wion.config.json`; its `teach` section names the person and the starting steps, here `Given Ava is signed in`). Click through as usual. Each action becomes one generic step:

| You do | Step |
| --- | --- |
| click a button or link | `When Ava clicks "Add plant"` |
| type into a field | `And Ava fills "Name" with "{new name}"` |
| pick from a list | `And Ava chooses "Medium light" in "Light"` |
| **Option+click** (Alt+click) a text | `Then Ava sees "{new name}"` |

- **Name anything new `wion-test-…`** (for example `wion-test-fern`; `wion test fern` with spaces counts too). The recording writes `{new name}` instead, and every test run makes a fresh name and deletes it afterwards. Anything else typed is kept as typed, and a note warns that it would be left behind.
- **Option+click marks a check:** the text flashes green, and the click does nothing else.
- Pressing Enter in a form counts as clicking its button.
- **Passwords are never recorded.** A control without a name, a checkbox, or a recording without any check becomes a note in the feature's description, never a silent gap.
- **Enter in the terminal finishes** (so does closing the window); Ctrl+C cancels and saves nothing.

The recording is checked with `bddgen` and saved as a proposal tagged `@recorded`; `wion review` approves it into `tests/features/<scenario name>/` (or `--feature <folder>`), exactly as for [AI drafts](ai-drafts.md).

**Known limits:** only clicks on buttons and links, typing, list choices and checks of visible text are recorded; drag, hover and uploads are not. One `{new name}` per recording. The steps are UI-level; shorter domain steps can come from `wion draft`. Recording in the demo leaves the `wion-test-…` plant in its data; `npm run demo:reset` cleans up.
