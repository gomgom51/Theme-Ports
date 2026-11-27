# Balance simulation — how to measure the effect of a change on players

One command runs the same AI simulations, on the same seeds, for several versions of the game
(main, a PR branch, a release bundle) and writes a side-by-side report. Use it whenever Clement
asks "how does this change affect players?", and before/after a release bundle that touches the
simulation. It does not replace the CI tests (`npm test`); it never runs in CI.

The four existing balance tools (see `CLAUDE.md` → Balance tools) are reused as they are, inside
each version's own checkout, so an old branch is measured with its own tests. The population run
(`tools/balance/population.mjs`) is new: it replaces the ad-hoc "96 companies" scripts used during
the first balance passes, which were never committed.

## Command

```sh
git fetch origin
node tools/balance/compare.mjs \
  --ref main=origin/main \
  --ref pr5=origin/claude/project-thread-yubbv3 \
  --ref bundle=origin/main+origin/claude/project-thread-yubbv3+origin/claude/project-thread-bvg449 \
  --suite full --out docs/balance/reports/2026-11-27-pr5-pr7
```

- `--ref name=gitref` (repeatable): the first one is the baseline; deltas are against it.
  `a+b+c` builds a temporary merge of b and c onto a (same as a release bundle). A merge conflict
  stops the run.
- `--suite smoke | quick | full`: `smoke` checks the tool itself (2 min); `quick` gives a first
  look (≈ 10 min per version on 4 cores); `full` is the one to decide on (≈ 12–15 min per version on
  4 cores; run it in the background).
- `--only pop,strat,fleet,vic`: pick parts. Skip `vic` when the change cannot touch victories.
- `--jobs N`: parallel simulations (default: all cores).
- Versions are checked out as detached git worktrees in the system temp folder and removed at the
  end; your working tree is not touched.

Output: `report.md` (read this) and `raw.json` (every number, to recompute or dig) in `--out`.
Commit the report under `docs/balance/reports/<date>-<what>/` so later threads can compare
against it, and copy it to the project files folder for Clement.

## What is measured

| Part | Script | Setup (full suite) | Answers |
|---|---|---|---|
| Population | `tools/balance/population.mjs` | 24 games × 4 AI companies, 5 years, victories off; home ports rotate so every non-seasonal port is played; leanings as in a normal game | Do companies still grow (median, bottom 10 %, top 10 % net-worth multiple), any bankruptcy / NaN, which leaning gains or loses, and **per ship model and category**: net M$ per ship-year, share of time loaded and at the quay, how many the AI buys |
| Strategies | `tests/strategies.test.mjs` | 16 markets, 5 years, 4 specialised companies (cargos, bulk, tankers, liners) starting with a ≈ 4 M$ ship | Rule 3: does one strategy win more than 60 % of markets? |
| Fleet | `tests/fleet.test.mjs` | Each model alone, 4 seeds, 2 years, neutral freight cycle | Is every model still profitable, and by how much did each move |
| Victories | `tests/victories.test.mjs` | 16 AI games (one company per leaning), up to 14 years | How many games are won, median year, which path wins |

## Reading the report

- **Same seeds, but not the same games.** Any change that draws one more random number reshuffles
  every later event. Trust medians and the paired count ("better for X companies, worse for Y"),
  never a single seed. A median move smaller than ±10 % on the quick suite is noise.
- **Player impact = per-model and per-category rows.** The AI plays roughly like a competent
  player; a model whose net per ship-year or AI purchase count moves a lot is where players will
  feel the change.
- **The AI only does what `sim/ai.js` tells it.** A new player option the AI never uses (for example
  a switchable item delivered off) shows no effect here: say so in the report rather than
  concluding "no impact".
- Check the targets in `CLAUDE.md` → "Final balance pass (done) — results to preserve".
- Per the project rules, balance is tuned at the final pass; between features, the report is used
  to spot correctness problems (NaN, bankruptcies, a model that stops being profitable) and to tell
  Clement what a change does to players.

## Adding a metric

Add it to the JSON written by `population.mjs` (one game per process, plain numbers), then add a
table in `compare.mjs` → "Rapport". Keep the old fields so older `raw.json` files stay comparable.
