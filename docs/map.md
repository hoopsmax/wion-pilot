# Map an app

[← Wion-Pilot](../README.md)

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
