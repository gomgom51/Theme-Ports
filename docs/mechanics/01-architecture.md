# 01 · Architecture and game loop

## Layout

```
web/                     static site (no build step), also wrapped by android/ (WebView)
  index.html, sw.js      page + service worker
  js/main.js             entry: app object, render loop, notification handling, saves
  js/i18n.js, i18n/en.js French→English translation at display time
  js/sim/                pure simulation (no DOM) — everything in these docs
  js/data/               static data: ports, flags, ships, goods, clients, equipment, offices,
                         sanctions, zones; generated: world.js, distances.js, countries.js
  js/ui/                 panels, map, scenes (pixel art), audio, saves, guide, credits
tests/                   balance tools (node), see CLAUDE.md
tools/                   generators: build_world, build_distances, build_countries, i18n-extract;
                         i18n-check (guard: no French left in the English version),
                         i18n-screens (same guard on the real screens, hidden browser)
docs/mechanics/          this reference
```

The other repository (`Rocket-to-planet`, "Fusée Planètes") is a separate kids' space game, unrelated.

## Simulation entry points (`web/js/sim/game.js`)

- `newGame(opts, ctx)` → state. Seeds `Rng`, `initMarket`, creates companies (cash from
  `DIFFICULTIES`: facile 12 M$, normal 8 M$, difficile 5 M$; AI skill 0.7 / 1 / 1.3), assigns AI
  leanings (shuffled, then swapped so a shadow home port gets `ombre` and a hub gets `conquerant`),
  starting trust = virtue = `rating × 0.5 + 25`, 3 market days, contracts, 3 starter contracts per
  home port (2 `caboteur` + 1 `polyvalent`, `minRep 0`), starter used ships at each (start) home port.
- `tick(state, ctx, hours)` → `notes[]` for the UI. Runs `stepHour` per hour.
- `migrateState(state)` upgrades old saves (`SAVE_VERSION = 3`).
- `ranking(state)` sorts by net worth.

### Order of one hour (`stepHour`)

1. `state.t += 1`; `moveStorms`.
2. For every ship: time accounting (`ship.hours`, `shipTrack().h` by `activityOf`), then
   `sailHour` (at sea) or `portHour` (in port).
3. New-build orders due → `deliverOrder`.
4. Every idle AI ship → `aiShipIdle` (see [16](16-ai.md)).
5. If `t % 24 == 0` → `daily`.

`portHour`: idle fuel burn; when `busyUntil` passes, finishes the activity: delivery after
unloading (`deliverContract`), dark-job offer after unloading in a dark port, repair target
applied, pending detention / bogus hold started, prospect resolved, queued `plan` launched
(`act.runPlan`), family-first contract created, "ship ready" note.

`sailHour` and `arrive`: see [08](08-voyages-routing-ice.md).

### Order of one day (`daily`)

```
dailyMarketUpdate → dailyEvents → dailyStorms → refreshContracts → refreshOffers (parcels)
→ dailyReceivables → clientsDaily → plotsDaily (also flushes queuedNotes) → takeoverDaily
→ shadowDaily (blacklist) → iceDaily → darkDaily (aftermath, disasters) → tradeDaily (tenders)
→ loansDaily → homeDaily (family rival, family contracts, shadow lender)
→ per ship: insurance premium, crew + equipment upkeep, opex (laid up: crew ×0.2, opex ×0.3)
→ per company: debt interest, overdraft interest (20 %/yr), checkBank, AI: aiDaily,
   aiPlots (day%30==15), aiTakeover (day%30==20)
→ weekly (day%7==0): refreshUsedMarket, recordHistory
→ 1st of month: monthly (tax, books roll, standing summary note)
→ levelsDaily → honoursDaily → victoryDaily → checkEnd
```

Order matters: e.g. victory is checked after honours; bank seizure happens before AI daily.

### Monthly (`monthly`)

Tax = positive monthly profit × `FLAGS[flag].tax`; `month` book rolls to `lastMonth`;
standing log (`standingMonth`) rolls to `standingLast` and a `standing` note is pushed for humans.

### End (`checkEnd`)

Duration elapsed (`settings.duration` years; 0 = endless) or every human bankrupt. Victories end
the game earlier (`victoryDaily` sets `state.over`).

## State shape (main fields)

```
state = { version, seed, t (hours since 1 Jan 2027), rng (Rng state), nextId,
  settings: { duration, difficulty, autoPause, victories{domination,reputation,legend,shadow} },
  market: { world{good:index}, freight{hold:rate}, cycle, fuelPremium, shipIndex, repairLoad },
  ports: { port: { good: { ou, imp, stock } } },
  companies[], ships[], contracts[], used[] (broker), orders[] (new builds),
  storms[], canals{suez|panama}, strikes{port:until}, news[], payments[], receivables[],
  offers[] (parcels), cases[] (customs bribe choices), plots[], bids[], tenders[],
  aftermath[], goodwill[], clients{id:{rel,downUntil,named}}, disasters{}, ice{}, iceSeason,
  oilCrisis, records{}, evil{}, familyRival{}, spills[], wrecks[], stats{}, marketHistory[],
  queuedNotes[], victoryClaimed, over }
```

Company: `id, name, human, homePort, flag, cash, debt, reputation, confidence, virtue, infamy,
trust{port}, grudge{port}, clients{id:{loyalty,deliveries,grudgeUntil,incidents,last}},
lenders{port:n}, lender (shadow lender), bans{flag:until}, insurance, level, hon{…},
blacklisted, reprieve, repHold, creditCut, month/lastMonth/total books, history[], pastShips[],
ai{skill, nextFleet, daring, leaning, noEmbargoUntil, pool, noTrade}`.

Ship: `id, owner, type, name, builtT, condition, fuel, status, port, busyWhat, busyUntil,
voyage{from,to,speed,closed,progress,departT,nm,eta,waitCanal,stalledUntil,storms,startCond,nsrEscort},
cargo{good,qty,hold,contractId | cost,boughtAt,loan,floor, damage}, plan, pendingDelivery, crew,
xp, skills, equipment[], taint, contraband, dark, seized, hijacked, iced, tip, detention,
heldBogus, repairTo, st (results tracking), log[]`.

## Runtime context (`sim/context.js`, not saved)

`makeContext()` → `ctx` with the `Router`, a per-ship route cache, and:
- `closedCanals(state, draft, ship)` — Suez/Panama closed by event or draft limit; NSR closed if
  draft > 14 m or not `nsrUsable` (ice).
- `distanceInfo(from, to, closed)` — reads `DISTANCES` / `DISTANCES_CLOSED` tables (falls back to
  live routing if the closed-set diff is missing).
- `route(from, to, closed)` — full polyline with `canalAt` (nm where each canal is crossed).
- `shipRoute`, `shipPosition`, `forget`.

## RNG and determinism

`Rng` (`sim/util.js`) is a seeded PRNG; its state is stored in `state.rng` after each tick.
Any added random draw reshuffles all later events for a seed (CLAUDE.md: compare balance variants
on the same seeds). Ice dates use a separate hash of (seed, place, year) so they don't consume RNG.

## Notifications to the UI

Sim functions push objects `{kind, company, shipId?, text, …extra}` into `notes` (only for human
companies, via `note()` in game.js). Code paths that run outside the daily cycle (actions, contract
generation) push to `state.queuedNotes`, flushed into the next day's notes by `plotsDaily`.
`main.js → handleNotes` maps `kind` to popups/scenes/sounds and auto-pause. Kinds include
`idle, depart, arrival, payment, incident, breakdown, storm, sunk, fuel, detention, held, customs,
sanction, patrol, pirates, hijack, seized, darkoffer, paid, aftermath, golden, goldenTaken, aid,
tender, tenderCommit, tenderDelivered, threat, scandal, sabotage, bid, takeover, absorbed,
takeoverRisk, victoryAlert, level, deed, record, recordLost, evil, blacklistWarn, blacklisted,
ice, iceSoon, icecaught, crew, prospect, banker, bank, bankrupt, standing, event, over, info`.

The **important notifications** panel (rule 1) is `ui/alerts.js`: it recomputes from state
(uninsured ships, held/seized ships, low fuel, overdraft, loans due, threats, lender quota…).
Each alert carries its full sentence (`text`, shown on hover) and a one-line `short` = [who, what with the key figure]
that the panel lists, one row per alert sorted by urgency (owner's call: bare minimum). A new alert needs both.
Opportunity cards (`ui/opps.js`) follow the same idea: three or four lines (deal, nearest able ship with its type and
days to get there, deadline), buttons on the right, details unfolding on hover.

## UI map (`web/js/ui`)

| File | Role |
|---|---|
| `main.js` | app state, speed/pause, HUD, panel routing, `handleNotes`, autosave |
| `panels.js` | fleet, port, broker (used + new builds), office (company, finances incl. shadow lender, results), markets, news, help |
| `panel-ship.js` | ship sheet: contracts list, trade (buy/sell, financing, tenders), departure with risk lines, voyage, crew, equipment, log |
| `risk.js`, `piracy.js`, `shady.js`, `dark.js` | risk lines shown before decisions (rule 1) and decision dialogs |
| `payment.js` | collection window (accept / contest, denounce / stay discreet) |
| `opps.js` | persistent opportunity cards (golden deals, aid, tenders) |
| `rivals.js`, `plots.js` | Office → Rivals (takeover, attacks, parries), shady-deal UI |
| `victory.js`, `codex.js`, `standing.js` | Office → Victories / Trophies, victory guide, monthly trust/virtue summary |
| `alerts.js` | important notifications panel |
| `screens.js`, `homebonus.js` | title, new game (home-port picker with perks), end screen |
| `map.js`, `mapships.js`, `waters.js` | world map canvas, ship sprites, national waters. Layers: the base (sea, land, port dots) and the port names are cached and redrawn on a view change; every frame draws zones, routes and ships, then lays the port names over the ships, then the selected ship (ring and stencil name) and the dock badges on top. Port names are placed biggest ports first, on their `LABEL_PLACE` side or the first free side, and a small port with no room waits for a closer zoom; docked ships fan out on the side left free. Sizes (`mapSize()` in `mapships.js`): ships ×`MAP_SHIPS`, port names `CITY_PX` px at 1920 × 1080, both × `uiScale()`, like the other map text. Fine pixels redraw the sprite with more pixels; chunky blocks go from 2 to 3 screen pixels, never more |
| `scenes*.js`, `pixel.js`, `shipart.js`, `officeart.js`, `trophyart.js`, `logos.js`, `flags.js` | art |
| `officepx.js`, `officeroom.js` | the company office in fine pixel art (ships' style), painted as the background of the Office panel on every tab: brass level plate, clickable jukebox, trophies and misdeeds pixelized from `trophyart.js`; the tab content is a sheet sliding over the room (`def.room`, `def.mount` in `renderPanel`) |
| `audio.js`, `sounds.js`, `jukebox.js`, `intro.js`, `credits.js` | sound, music, intro, end credits |
| `motion.js` | interface motion (owner's picks, "mechanical but smooth"): panels slide out from under the rail like a drawer and stop firmly (the old panel slides back in first), a brass bar sweeps a new tab in below the part shared by every tab (Office picture, ship header; the underline slides), dialogs are stamped onto the map with a small jolt and a soft synthesized thud (`stamp` in `sounds.js`, effects volume; drawer and wiper stay silent). The collection receipt, shown after nearly every delivery, keeps the stamp and thud without the jolt (`dialog({ shake: false })`, owner's call: the jolt stays for rare dialogs such as ice, takeover, blacklist). Only opening, closing, switching panel or tab animates, never the 1.2 s refresh; nothing moves under `prefers-reduced-motion`. Timings in `MOTION` |
| `scale.js` | interface size: the game is laid out for 1920 × 1080 and grows with the screen (CSS `zoom` on `<html>`, factor `uiScale()` = max(1, min(width / 1920, height / 1080)) × the ☰ menu size: Petite 0.85, Normale 1, Grande 1.15, Très grande 1.3; 2560 × 1440 → 1.33). Rules: viewport units in `style.css` go through `--vw` / `--vh`; screen coordinates (`clientX`, `getBoundingClientRect`, `innerWidth`) are converted with `localRect()` / `viewport()` before setting a CSS position; a canvas inside the zoomed interface counts `pixelRatio()` device pixels per CSS px (`pixelship.js`); the map and the intro canvas are `.unzoom` (drawn 1:1 in screen pixels, the map reads `uiScale()` for its own sizes). Event `uiscale` on `window` when it changes |
| `panelsize.js` | side panel width (owner's pick): about 40 % of the screen by default (`--panel-w`, clamp 560–820 px), and a brass drawer pull on its left edge to drag it wider or narrower (the map keeps at least 420 px); the width is remembered (`pda-panel-w`), a double-click restores the default. The pull hides while the drawer slides in (`gripAfter`). Toasts and the ticker follow `--panel-cur` |
| `profile.js` | player profile, shared by every save (today: jukebox unlocks). A track unlocks when heard, or as soon as a save reaches its milestone (`earnedTracks` in `jukebox.js`: office reached, net worth peak in `history`, blacklist, victory alerts, game over), checked on load, once per game day, and once over all save slots. The one place to change when the desktop build moves the profile to a file |
| `shipnames.js` | every boat name in Stardos Stencil (owner's call), including inside sentences: after translation, known ship names (fleet, broker, cumulated over the session) are wrapped in `span.nm` inside a `span.nm-text[data-no-tr]`; skip an element with `data-no-name`. On the map (canvas, `map.js` `label`), only the selected ship shows its name, in 15 px stencil × `uiScale()` (owner's call). The same pass makes every city name clickable (owner's call): French and English port names (plus « Havre », « Pirée » after au/du) become `span.city[data-port]`, green underline on hover; a click (capture phase, so a list row does not open) calls `app.focusPort` → `map.flashCity` (the map glides, zoom kept, when the city is off-screen or hidden by a panel, then a green halo and rings like `flashShip`'s gold ones) and a sonar `ping` (`sounds.js`, one clear note and its echo; `focusShip` plays the same one, owner's call). Not in action buttons (`.btn`, `.chip`, `.icon-btn`, `.opp-port`), links, labels or the title screens (`#screen`); `data-no-city` opts an element out. Company and captain names are matched first and left alone (a captain Valdez is not a link) |
| `guide.js` | guided tour (keep `data-guide` markers) |
| `save.js` | localStorage slots, export/import, `migrateState` on load |

## Tests and tools

See the "Balance tools" section of `CLAUDE.md`. `npm test` = routing + 3-year sim (correctness)
+ `tools/i18n-check.mjs` (English version: no French text left, from the code, glued fragments or a simulated game)
+ `tools/i18n-screens.mjs` (the same on screen: a game played in English in a hidden browser, every panel opened);
`npm run balance` = fleet + strategies (final balance pass only). `npm run build:world` regenerates
map, countries and distance tables. To measure what a change does to players, compare versions with
`tools/balance/compare.mjs` (see `docs/balance/README.md`).
