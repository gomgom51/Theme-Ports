# Code health: rules that keep the code consistent

Many threads change the same files. The code review of 2026-11-28 found what that leaves behind:
- copied helpers (the same number formatter written a dozen ways);
- settings stored from 11 files;
- dead functions;
- old saves upgraded in two places with no test;
- two drawing styles side by side.

These rules stop it from coming back. The mechanical ones (✓) are checked by `node tools/code-check.mjs`.
It runs in about a second, and `npm test` and CI run it on every PR. The tool prints the file, line and rule.

## Where shared things live (use them, never copy them)

| Need | Use | File |
|---|---|---|
| Write a sum, a number, a percentage, a probability | `money`, `num`, `num1`, `tonnes`, `pct` (value already 0–100), `pctOf` (share 0–1), `chance`, `dec` | `sim/format.js` (re-exported by `ui/dom.js`) |
| Book an income or an expense | `book(state, company, amount, category, ship)` | `sim/core.js` |
| Store a setting, the player profile, a save | `KEYS` + `read` / `readJSON` / `write` / `writeJSON` / `readFlag` / `writeFlag` / `remove` | `ui/storage.js` |
| Load an old save | `migrate(state)`, `SAVE_VERSION`, numbered `STEPS`, `fillDefaults` | `sim/migrations.js` |
| Build the interface | `h()`, `dialog`, `confirmBox`, `toast` | `ui/dom.js` |
| A 1–5 rating | `gradeEl` (one rising-bars icon) | `ui/grade.js` |
| Rivals of a company, office level of a company | `rivalsOf`, `levelOf` | `sim/core.js` |
| Office level rules (tiers, music steps) | `OFFICE_TIERS`, `officeTier`, `musicStep`, `reachedTier`, `shownTier` | `data/offices.js` |
| Ship proportions for every drawing | `SHIP_ART` | `ui/shipshapes.js` |
| A ship in an event scene (real model, to scale, chunky) | `sceneShip`, `sceneShipOf` | `ui/sceneship.js` |
| The office in a scene | `officeShot`, `drawOfficeShot` | `ui/officescene.js` |
| Contracts and trades a ship could take now (sorted by profit per day), best port to sell its cargo | `jobOptions`, `bestOutlet` (AI and captain's choice) | `sim/ai.js` |
| A ship waiting for the player's orders (counts, alerts, auto-resume, Tab) | `waitsForOrders`, not `isIdle` (which also counts ships on standing orders); `onOrders` | `sim/orders.js` |
| Risk shown before a decision (rule 1) | `riskLines`, `shadyLines`, `darkLines`, `piracyLine`, `patrolLine`, `iceLines` | `ui/risk.js`, `ui/shady.js`, `ui/dark.js`, `ui/piracy.js`, `ui/panel-ship.js` |

If a helper you need is missing, add it to the file in the table and import it. Don't write a local copy "just
for this file". If the helper is not in the table yet, add a row.

## Rules

1. ✓ **One way to write a value.** Sums, numbers and percentages go through `sim/format.js`, both in the simulation
   (notifications, news, ship log) and on screen. So:
   - no `(x / 1e6).toFixed(…) M$`;
   - no `Math.round(x / 1000) k$`;
   - no `toLocaleString('fr-FR')` and no `Intl.NumberFormat` anywhere else.

   `i18n.js` converts these formats to English (`12,45 M$` → `$12.45M`, `1,2 Md$` → `$1.2B`). That is why a
   template writes `${money(x)}` and never the unit. A template whose money part changes shape needs its `en.js`
   key updated too (for example `"Il faut {0}."`, not `"Il faut {0} M$."`).
2. ✓ **Storage only through `ui/storage.js`.**
   - A new setting gets a key in `KEYS`.
   - Never rename an existing key: players would lose their settings or their games.
   - `write` returns `false` when storage is full or blocked. If losing the value matters, tell the player, as
     `autoSave` does in `main.js`.
   - The desktop build (Steam Cloud) will change only this module.
3. **Saves stay loadable.** A save from the released version must load in the next one. A lost game after an
   update is the worst bug a player can meet.
   - A new field stored in the state, a company or a ship gets two things: its value in `newGame` / `createShip`,
     and a line in `fillDefaults` (`sim/migrations.js`) for games already in progress.
   - A change that is not "fill what is missing" (a renamed field, a changed unit, moved data) becomes a numbered
     step in `STEPS`, and `SAVE_VERSION` goes up by one.
   - Before changing the format, make a test save with the released version:
     `git worktree add /tmp/pda-main origin/main`, then `node tools/save-fixture.mjs vN-bundleX 3 /tmp/pda-main`.
     Commit it in `tests/saves/`. `tests/saves.test.mjs` loads every one of them on each test run, plays two
     months, and checks that a second upgrade changes nothing.
   - Don't add new scattered `x.field ??= …` defaults for stored fields in sim files. About 80 of them exist.
     Move them to `fillDefaults` when you touch that code.
4. ✓ **Names say what they do.** `book(state, …)` records money. `money(x)` writes a sum. Since the review,
   `money(state, …)` no longer exists in the simulation.
5. ✓ **The simulation stays pure.** `web/js/sim/` imports nothing from `ui/` and never touches `document`,
   `window` or storage. This keeps it testable in node, by the balance tools and by the save tests.
   - Random draws only use the `Rng` that is passed in (`Math.random` is used once, for a new game's seed).
   - A new draw reshuffles every later event for a seed. Mention it in the PR if balance results matter.
6. ✓ **No dead code.**
   - An exported function that nothing uses, or an import a file doesn't use, fails the check.
   - A deliberate exception goes in `KEEP_EXPORTS` (`tools/code-check.mjs`), with its reason.
   - When you remove a feature, remove its helpers, styles and `en.js` entries in the same PR.
7. **One definition per knob.** A tuning value lives in one exported constant. The tuning knobs are listed in
   `CLAUDE.md`, and the screen reads them from there.
   - Never retype a number in a text: write `${pctOf(RISK.x)}`, not "12 %".
   - Rule 1 (no hidden risk) depends on it: the figure shown must be the figure simulated. A risk or a price shown
     before a decision calls the same function the simulation uses.
8. **Import direction.**
   - `data/` ← `sim/` ← `ui/` ← `main.js`.
   - `sim/core.js` should only import `sim/util.js`.
   - Today the simulation has 9 import cycles (`node tools/code-check.mjs --cycles`). Don't add one. When you
     touch those files, break one by moving the shared function down (into `core.js`, or a small new module).
9. **Texts.**
   - French is the source, and the English entry goes in `en.js` in the same change.
   - Sentences are whole templates (`…${x}…`), never glued with `+`.
   - `node tools/i18n-check.mjs 0` checks the code texts in a few seconds. Without the `0`, it also plays a game.
10. **Art.**
    - New art uses the pixel styles: ships with `ui/pixelship.js` / `ui/mapships.js` (and `ui/sceneship.js` in
        event scenes), and the office with `ui/officepx.js`.
    - Both ship styles (fine and chunky) must keep working.
    - The vector ship and office drawings are gone: every ship and office on screen is pixel art.
    - Ask the owner before starting a new family of drawings (CLAUDE.md).
11. **Panels are rebuilt, not patched.**
    - `renderPanel` (`main.js`) replaces the whole panel on every refresh: about every 1.2 s while the game runs,
      except when the player acted in the last 2.5 s or a dialog is open.
    - Keep interface state (open section, chosen option, slider value) in a module variable or in `app.ui`,
      never only in the DOM.
    - A text field keeps its value and cursor only with `data-focus-key`.
    - Panel functions run often, so cache heavy drawings.
    - Nothing animates on a refresh (`motion.js`).
12. **Interface size.** Follow the `CLAUDE.md` conventions: `calc(N * var(--vw))`, `localRect()` / `viewport()`,
    and `pixelRatio()` for canvases. The reference screen is 2560 × 1440; also check 1920 × 1080, 16:10 and 21:9.
13. **Desktop first.** The phone version is dropped. Existing phone code stays as it is, but don't add new
    phone-only or touch-only paths.
14. **Docs in the same PR.** This is the owner's rule (PR template). A new shared helper gets a row in the table
    above.

## Before opening a PR

- `node tools/code-check.mjs` (one second).
- Added or changed a text: `node tools/i18n-check.mjs 0` (a few seconds).
- Changed what a save holds: a test save from the released version, then `node tests/saves.test.mjs`.
- The full `npm test` runs once, at release, in the bundle (owner's process).

## Known debt (not fixed yet)

- 9 import cycles in the simulation (list: `node tools/code-check.mjs --cycles`).
- About 80 scattered `??=` defaults for stored fields (rule 3).
- `en.js` still holds entries no code uses any more. Composed texts make automatic pruning unreliable, so remove
  entries by hand when you remove their text.
- `abandonContract` (`sim/actions.js`) has no button yet. It is kept in `KEEP_EXPORTS` until the owner decides.
- The body text uses the operating system's font. Waiting for the owner's choice.
