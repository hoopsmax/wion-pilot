# AI drafts

[← Wion-Pilot](../README.md)

`wion draft` asks an AI for new BDD scenarios; `wion review` lets a person approve them one by one. **Nothing enters `tests/features/` without that approval.**

```bash
npm run wion -- draft "watering reminders"                                # by topic
npm run wion -- draft --diff main --provider claude                       # from the code change since main
npm run wion -- draft "watering reminders" --diff main --provider claude  # both
npm run wion -- review
```

**What the AI gets:** the topic and/or the app's code change (`git diff`, files under `apps/` only), a short summary of the app map (screens, fields, buttons; no screenshots; run `npm run map:sprout` first for better drafts), the list of shared steps from `tests/steps/`, and the hand-written features as examples of how steps go together (which ones must come first). AI drafts are never shown as examples, nor features tagged `@not-an-example` (the demo bug, and the features that test wion itself). With a code change it also explains in plain words what changed and writes a test plan.

**Before anything is sent**, the prompt is redacted: email addresses, the values of environment variables named like `PASSWORD`, `TOKEN`, `KEY` or `SECRET`, and long key- or hash-like strings become `<email>` / `<secret>`. The command says how many it removed.

**Providers** (one interface, `packages/core/src/draft/providers/`):

| Provider | What it does |
| --- | --- |
| `none` (default) | No AI call. Saves the prompt in `.wion/prompts/` to paste into any chat; bring the answer back with `--answer <file>`. |
| `ollama` | A local model through Ollama (`--model`, default `llama3.1`). Free; nothing leaves the computer. |
| `claude` | Opt-in. Claude Opus 5.5 by default (`--model` to change), through Anthropic's SDK. Needs `ANTHROPIC_API_KEY`: copy `.env.example` to `.env` and fill it in (`npm run wion` reads `.env`; git ignores it). Create the key in the Claude Console under API keys, for a **workspace** (a key for the whole organization is refused). A call waits at most 3 minutes. |

**The answer is checked, never trusted:** the AI must answer with JSON in a fixed shape; our code writes the Gherkin; then `bddgen` checks it against the shared steps only. A made-up step fails the check and is named; such a draft is kept in `.wion/proposals/` with the reason but never offered for review. Steps the AI would need but that do not exist are listed as comments ("missing steps"), for a person to write.

**Review** shows each scenario of each passing proposal and asks: approve, reject, skip the proposal, or quit. Approved scenarios are checked again and written to `tests/features/<feature>/<feature>.feature` with a header saying who drafted them and when they were approved (or added to the end of an existing file; nothing is overwritten). Every drafted feature carries the `@ai-drafted` tag.

**Run what you approve.** `bddgen` checks that every step exists, not that the steps come in a working order. The first real draft (the `watering-reminders` feature) passed the check, yet two of its scenarios failed when run: they changed a field without opening the form first. So run approved scenarios before committing them (`review` prints the command), and fix or drop what fails. Since then the AI sees the hand-written features, which show the order.

**Ledger:** every real AI call (also a failed one) adds a line to `.wion/ledger.jsonl` with the provider, model, tokens, seconds and an estimated cost; the command prints the same.
