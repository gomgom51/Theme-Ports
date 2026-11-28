# Port d'Attache — design rules for this project

**Start here:** `docs/mechanics/README.md` maps every game mechanic, its code, its constants and how
the systems connect. Read the relevant file there before exploring the code.

**Docs in the same PR (owner's rule):** a PR that changes a mechanic, a constant, where something sits in the
UI (a button, tab or panel that moves), or adds a code file updates the matching `docs/mechanics/` file in that
same PR, or says in the PR body why none is needed (PR template checkbox). At release, the bundle thread checks
every included PR for this and fixes small gaps in the bundle.

**Changelog (owner's rule):** every release bundle adds its entry to `docs/changelog.md`: what is new and every bug
fix (symptom for the player, cause, guard against a repeat).

This is a **management game**. Balance and player agency come before realism.
Every design or balancing choice must be checked against these rules (set by the
project owner):

1. **No hidden crucial risks.** The player must never suffer a *major setback*
   (losing a ship, an uninsured loss, a detention, a seizure, a large fine or
   claim) from a risk they could not know about. Such risks must be visible
   *before* the decision that exposes the player to it: show the probability
   or level, the consequence, and how to avoid it. Small speed bumps from time
   to time (a short breakdown, a minor delay) are fine without warning.
   Critical information scattered across ships and ports is gathered in the
   **important notifications** panel.
2. **No forced chores.** Don't make the player do things they don't want to
   do. When the game imposes a consequence, offer a choice in how to face it
   (e.g. a detained ship can be repaired or sold on the spot).
3. **No dominant strategy.** Several strategies must stay viable (small
   flexible ships, bulk, tankers, containers, giants, old cheap ships vs new
   ones, contracts vs trading, different home ports), with none clearly
   championing the others. Context-dependent opportunities are good: a strategy
   may shine in a given market phase or region, as long as no option is always
   the most efficient play.
4. **Choices, not traps.** Options that look attractive must carry visible
   trade-offs (cheap old ship = more incidents, more repairs, inspections).

## Balance

Do **not** balance while features are being built: balancing something that
new features will unbalance is wasted work, and the features themselves will
be the tuning tools. During development, only check correctness (no crash, no
NaN, the simulation runs, saves load). Balance is tested and tuned once, at the
end, with the tools below.
Intended strengths to preserve: general cargo ships (small, flexible holds)
will be the best tools for grey and black trade.

Feature order agreed with the owner: 50 ports → pollution → grey/black trade
→ equipment → piracy (simple: defence vs boarders → result) → full balance pass.

### Balance tools (final pass only — not run in CI)

- **Comparing versions** (what a change does to players): `node tools/balance/compare.mjs --ref main=origin/main
  --ref pr=origin/<branch> --suite full` runs population, strategies, fleet and victories on the same seeds for
  each version and writes a side-by-side report. Process, metrics and how to read them: `docs/balance/README.md`;
  past reports in `docs/balance/reports/`.
- `node tests/fleet.test.mjs` — every ship model profitable in a normal market.
- `node tests/strategies.test.mjs` — no strategy dominates across seeds; each
  one wins in some markets.
- `node tests/sim.test.mjs 3 12345` and a 10-year run — no NaN, AI neither
  runaway nor wiped out.
- `node tests/victories.test.mjs 13 1,2,…` — AI-only games (one company per leaning) stopped at the first
  victory: when it comes and which path wins (target below).
- Tuning knobs: `BALLAST` / `BALLAST_HOLD` / `FREIGHT_*`, `SPREAD` (trade
  margins), `CYCLE` (freight cycle amplitude), `AGING` (used-ship depreciation,
  ageing costs), `AI_FLEET` (AI fleet cap) in `web/js/sim/economy.js` (all
  mirrored in `TUNING` for test sweeps); `RISK` and rates in
  `web/js/sim/incidents.js`; flag `tax` / `crew` in `web/js/data/ports.js`;
  shippers (`RESERVE_*`, `DENOUNCE_HIT`, `AI_DENOUNCE`, `GRUDGE_DAYS`, `GRATITUDE`,
  `clientDemand`) in `web/js/sim/clients.js`; shady deals (`PIRATE_*`, `HELD_CHANCE`,
  `EXPOSE`, `SCANDAL`, prices, `AI_PLOT_CHANCE`, `AI_POACH_CHANCE`) in `web/js/sim/plots.js`;
  per-goods trade spread `goodSpread` and `GOLDEN_CHANCE` in `economy.js`; crew skill
  effects and `XP_STEPS` in `web/js/sim/crew.js`, crew levels (`CREW_LEVELS`: wage, safety, `fight`, the free fourth
  level unlocked by the Vieux briscards skill) in `web/js/data/ships.js`; ice (`ICE`: announcement delay,
  ice-class extension, icebreaker escort fees, end-of-season contract premium,
  Northern Sea Route safety horizon) in `web/js/sim/ice.js`, seasonal windows (`ice` on
  ports in `web/js/data/ports.js`, `ICE_PASSAGES`), Arctic fee `CANAL_FEE.nsr` in `economy.js`;
  dark jobs and pro bono (`DARK`, `DARK_KINDS` pay/infamy, `CHARITY`) in `web/js/sim/dark.js`,
  infamy reputation cap `repCap` in `web/js/sim/core.js`; city tenders (`TENDER`: frequency, premium as a multiple of
  the good's natural spread with a floor and a cap, quantity, duration) and cargo financing (`FINANCE`: share lent and rate per port profile, destination bonus, track record,
  60-day term, late and early-repayment fees, exposure cap = half the net worth) in `web/js/sim/trade.js`; AI opportunity
  cost of cash locked in cargo `AI_CAPITAL_COST` and the largest possible embargo fine it accepts `EMBARGO_FINE_MAX`
  (share of net worth) in `web/js/sim/ai.js`; prospecting for shippers (`PROSPECT`: duration,
  odds per port size / reputation / loyalty / office / negotiation skill, lead share and range, pay) in
  `web/js/sim/prospect.js`; victories (`VICTORY`: alert steps, reputation level and deed count, legend record count,
  shadow years and fleet) in `web/js/sim/victory.js`, deed and record thresholds (`HONOURS`) in `web/js/sim/honours.js`,
  ordinary reputation cap `REP_BASE_CAP`, clean-conduct virtue gain `STANDING`, virtue sources `VIRTUE_SOURCES` and trust vs rivals `TRUST` (base, weight of the reliability gap, step, slip size and cap, memory, small-record prior) in `core.js`, takeovers (`TAKEOVER`: price = net worth × (1 + reputation / 50),
  30-day offer, six-month reprieve odds, AI ratios and margins) in `web/js/sim/takeover.js`, rivalry moves (`ATTACKS`:
  cost, certain reputation loss, scandal odds, effects, parry prices; `AI_ATTACK_CHANCE`) in `web/js/sim/plots.js`,
  blacklist (`BLACKLIST`: infamy line, warning, shadow bank) in `web/js/sim/shadow.js`, AI leanings (`AI_LEANINGS`,
  `AI_BUILDER_FLEET`) in `web/js/sim/ai.js`; ship cranes `GEAR_SIZE` (the smallest port size a geared ship loads at)
  in `economy.js`; standing orders (`ORDERS`: captain's fee as a multiple of one veteran sailor's wage, repair thresholds, call
  delays, default limits) in `web/js/sim/orders.js`.
- Lessons (trade): trade estimates must use the price expected on arrival
  (`quoteTradeAt`), or the "best outlet" is a port whose price is momentarily high and
  margins melt; a global `SPREAD` rise mostly helps bulk (widest spreads), so spreads
  are compressed per goods, with liquid bulk kept narrow (huge volumes).
- Lesson (trade, owner's playtest): plain arbitrage between exporters and importers barely pays at a realistic
  budget, outside embargoed countries. Trade lives on city tenders (fixed price, first come first served, rival
  commitments announced with their ETA) and cargo loans that let a small company fill a hold. No guaranteed
  price: trading keeps its risk. A tender's free quantity subtracts every other ship's commitment (own fleet
  included), and a ship commits as soon as its departure is planned, or several ships chase the same lot.
  A tender premium must follow each good's natural spread (`GOODS.spread`): a flat 10–26 % made dear goods
  (machines, manufactured goods) a fortune for small general cargo ships, which then won 8 of 16 strategy markets
  while bulk won none. Leverage needs a cap (total cargo loans ≤ half the net worth) and the AI must charge itself the opportunity cost of
  cash locked in cargo (`AI_CAPITAL_COST`), or it trades instead of buying ships: fleets stall, a few AIs
  become near-zero zombies and the richest snowball. Compare variants on the same seeds: any change to the
  random stream reshuffles single-seed results.
- Lessons (AI, balance pass after tenders and financing): every AI decision that can touch an embargoed port must
  check `avoidsEmbargo` and price `embargoCost`, including "sell here or carry the goods elsewhere" for cargo already
  on board. That branch once ignored it, and enforcing-flag AIs (US, NL, GR) detoured to Iran and Russia for a better
  price, then paid fines of up to 12 M$: it hid half the growth and caused the only bankruptcy. A possible fine larger
  than `EMBARGO_FINE_MAX` × net worth is refused. Laid-up ships must come back when freight recovers, even for a
  company with little cash (reactivation needs only its cost plus a small buffer), and a ship laid up for over a year
  is sold while the company is in debt, or small fleets die at the quay.
- Victories (owner's design, "civilization approach"): the time limit still decides if nobody wins.
  Sole master on board (every rival ruined or bought; "in sight" once a single rival is left and the leader holds half,
  then four fifths, of its takeover price in net cash — the last rival gets its own warning), the most respected (reputation 100: ordinary gains stop at 95,
  each of the first five of eight deeds raises the cap by one; level 4; then held six months without falling below 95,
  so rivals warned at 75–90 % have a window to strike), legendary (hold 5 of 8 exclusive records;
  numbered records can be broken, "complete" ones stay with the first), shadow fleet (years on the international
  blacklist with a fleet and a dark job in every embargoed country). Everyone sees everyone's progress (one medal
  per victory under the side rail, opening that path's page) and is warned at 75 % and 90 % (rule 1). Deeds are badges, records are trophies on the office shelf
  (award scene), misdeeds are grim proofs on a dark side table; a blacklisted company's office turns ostentatious
  (night outside, velvet, chandelier, gold bust, full safe: `paintOffice` option `shadow` in `ui/officepx.js`). The office is
  the Office panel's background on every tab, in the ships' fine pixel style (owner's pick): level on a brass plate, clickable jukebox, the
  figures on a paper sheet that slides over the room (`ui/officeroom.js`). Each level has its own view and furniture (owner's
  picks): rain on the quay, a fishing harbour at dawn, the harbour mouth at sunset, skyscrapers and the sea from a
  mahogany-and-blue-velvet floor (windows only, no paintings), above the clouds in white and black marble (no wood).
  Trophies, deeds and misdeeds are painted at screen resolution on their own layer so they stand out on purpose (`hi`
  output of `paintOffice`, option `S`). Office levels are sticky (company maturity) and gate
  takeovers (buy only a company of your level or below), the reputation victory, and bank pressure.
- Takeovers: paid from net cash (cash − debt − cargo loans), never borrowed. A human target gets a 30-day offer, can
  ask for six months (odds from reputation) and is warned whenever a rival can afford it. A blacklisted company can only
  be bought to be dismantled (fleet scrapped) at twice its net worth (shell companies), its reprieve odds follow its
  infamy, and AIs only move against it after the official 75 % warning: at net worth with no premium, a pariah was the
  cheapest buy and every shadow fleet was absorbed within three years. Inherited infamy that would cross the
  blacklist line is shown before buying. A blacklisted buyer can only buy another blacklisted company (the
  authorities would block the sale); against clean rivals its only road to domination is ruin, which is how the
  gravedigger misdeed reaches a shadow fleet (a bankruptcy is credited to the last rival that attacked within the year).
- Reputation (owner's design): two scores, to make the reputation victory harder. Trust 🤝 (`confidence`): you can be
  counted on — the whole economy reads it (premium contracts, shippers' requirements, disputes, credit, cargo loans,
  prospecting, takeover price): on-time deliveries, golden deals and city tenders served, new ports; late or damaged
  cargo, detentions, running dry, abandoned contracts, wrecks, lost disputes, hijacks. Trust vs rivals (owner's choice): an on-time delivery
  no longer adds a fixed amount (gains grew with the fleet, every honest company hit 95 in 18 months); it pulls trust
  toward a target = 82 + 300 × (own reliability − market reliability) + bonuses, reliability = 1 − slips / deliveries
  over about ten months. A quarterly trust report (Office → Compagnie) shows who gained shippers' trust. Alone it
  keeps everyone under ~90: new-ship and "future" contract bonuses plug into `trustTargetBonuses` (ship rework). Virtue 💚 (`virtue`): the
  greater good, or at least the press image ("you cannot win just by being efficient") — emergency aid, reporting
  dishonest shippers, useful goods (cereals, coffee and cacao, fruit and meat, wood), golden deals and tenders on cargo
  neither fossil nor polluting, slow steaming (bonus shown under the speed slider), a slow monthly gain for clean
  conduct and, below 50, forgetting; oil spills, smuggling, embargo fines, bribes, dark jobs, dirty tricks and scandals
  lower it. Reputation = the lower of the two; it only judges the reputation victory (and shows as ★ next to the cash,
  the limiting score in red). Infamy caps both scores (the price of dark jobs). A smear campaign hits both.
  Virtue does reach the economy through a few image-minded actors only: six customers (`CLIENTS.image`, one of
  them an oil major polishing its window) pay from −6 % at virtue 0 to +12 % at 100 (`IMAGE_PAY` in `clients.js`,
  shown on the contract, fixed at signing), and image-minded ports (`IMAGE_PORT_FLAGS`: NL, DE, FR, CA, AU, SG, JP)
  scale the chance of inspecting a worn ship from ×1.3 at virtue 0 to ×0.6 at 100 (`INSPECT_VIRTUE` in
  `incidents.js`, shown in the departure risks); detention once inspected still depends only on the ship.
  Carrying oil (crude, refined) costs virtue on every loaded departure (`VIRTUE_SOURCES.oil`, once per cargo, so the hit and its harp come as the ship sails), so an oil fleet cannot win the
  reputation victory; and a world event, the global refinery crisis (weight 1.5 in `EVENTS`, about one every 18 months,
  2 to 4 weeks: `OIL_CRISIS` in `events.js`), removes every oil contract and tender outside embargoed countries
  (signed contracts honoured), announced with its end date in the news, the important notifications and the tankers'
  Contracts tab. Owner's call to make tankers less of a safe default (they led the strategy test in every run).
  `company.trust` is something else: the gangs' trust, port by port (`dark.js`). Knobs: `STANDING`, `VIRTUE_SOURCES`
  in `core.js`; `FOSSIL_GOODS`, `USEFUL_GOODS` in `data/goods.js`.
- Home port bonuses (owner's design, to help the least played victories; `HOME` in `web/js/sim/home.js`): a shadow port
  (smugglers' port of an embargoed country: Bandar Abbas, Puerto La Cruz, Novorossiysk, Nampo) has gang trust from day
  one, home customs × 0.3, refusals at home without grudge or seizure, and up to 3 parcels on offer; a financial hub
  (the 8 size-5 ports) cuts takeover prices by 0 % at trust 50 up to 25 % at trust 100. Shown on the home-port picker,
  Office → Company and the relocation list; AI leanings follow the home port (shadow port → shadow AI, hub → conqueror).
  A winter port (Murmansk, Valdez, Ust-Luga, Gdańsk, Hamburg and the four seasonal ports, now pickable as home) fits a
  free ice-class hull on every ship bought (`winterKit`); a seasonal home port, frozen at the January start, puts the
  first ships and contracts in the nearest open port (`START_PORT`), and the AI never starts there.
  Owner's rules (round 2): a company based in a financial hub that buys a company based in an embargoed country pays a
  fine (half the price, at least 5 M$, `HOME.embargoFine*`) and is expelled: its head office moves to the bought
  company's port (warned on the rival card and in the confirmation; the AI does it only for its very last rival, or as a
  shadow AI); other buyers buy normally. Embargoed countries keep their dear bank, but a shadow lender is an opt-in
  alternative (Office → Finances): `SHADOW_LENDER` rate (8 %) while 2 discreet parcels are delivered every 6 months,
  else the bank rate until the quota is caught up (alert 45 days ahead; the shadow AI opts in). "Family first" ports
  (Buenos Aires, Luanda, Lagos, Cartagena, Veracruz, Arzew, Durban, Richards Bay, Djibouti: the flags that lost on every
  axis) always hold a reserved contract fitting the home company's free ship (`familyContract`, made as soon as the ship
  is free there), never offer anything to its biggest competitor by net worth (no contract, no prospecting, shown on
  its screens), and sell goods 5 % cheaper to the home company.
  Map: a ring in each company's colour around its home port, and a house pin over yours.
- Rivalry moves always cost reputation (word gets around), may leak (scandal), and the victim always hears a rumour with
  the parry price; AIs parry when cheap and aim at the rival closest to a victory (conquerors at their cheapest prey).
- Blacklist (infamy 80): enforcing ports closed, shadow bank only (half the credit, +15 points), but shady ports'
  shippers ignore reputation (the shadow network) — without it a blacklisted company starves. Warned at 60, and before
  any dark job that would cross the line (including the +10 if customs find the cargo).
- Lessons (victory tuning): non-exclusive deeds are the easiest path (nobody can take them from you), so their
  thresholds sit high; a shadow AI must ignore its flag's embargo stance, seek dark ports, avoid gang grudges and refuse
  jobs over 22 % customs risk, or it either never gets dark jobs or loses its fleet to seizures; an AI with no ship
  must be allowed to buy one despite its debt, or it idles forever.
- Standing orders (owner's design, `sim/orders.js`, mechanics doc 08): automation is earned and paid for. The regular
  line ↻ needs a crew confirmé or better with all 6 XP points; the captain's choice 🧭 needs the vieux briscards crew,
  costs 3 × one veteran sailor's wage a day (marginal next to what the ship makes, owner's call) and picks like the AI
  with no estimation error, within the player's limits. Taking
  control back from the captain without a call costs one Vieux briscards rank (the old hand leaves). A basic
  crew means every order by hand. Receipts stay manual (cashing in is the fun part). Rule 1: a ship under orders never
  takes a risk the player did not see when giving the order; a new one makes it call and wait.
- Ship readability (owner's design): broker cards and ship sheets list pros and cons as scales, never figures
  (`SHIP_ROLES` in `ui/shiproles.js`), so new players stop picking the biggest radar star (the radar's capacity,
  economy and range axes all grow with size). The ship's discretion at customs is shown as a 5-step scale with its
  sources on every parcel and dark-job offer; every graded scale uses one rising-bars icon (`ui/grade.js`, owner's call). Ship cranes (`gear`) load at medium-port speed in small ports, the
  1970s tanker is single-hulled (owner's call: no refusal, but a 49 % check at each strict-port call, fine (doubled in
  the three cleanest: Valdez, Le Havre, Yokohama) and trust loss like a detention, `HULL_CHECK` in `incidents.js`, until a reinforced hull is fitted), and the small general cargo
  ships come with a switchable transponder, off by default. Owner's call: no built-in hiding places (players can
  commit further by fitting them). To check in the final pass: `BALLAST_HOLD` pays the empty-return premium on every
  oil, gas and fruit contract, even when the ship chains loaded legs (refined products: 22 exporters, 29 importers).
- Lesson (shippers): a client's loyal-partner reservations must be extra offers on
  top of a port's contract pool, never take its slots, or idle fleets pile up.
- Ice (rule 1): freeze/thaw dates are random each year but the window is always shown,
  the exact date is announced `ICE.announce` days ahead, and every ice cost (escort in or
  out, risk at arrival) appears before the decision. Notifications (owner's call): one global freeze and one global thaw
  event when `ICE.season` (80 %) of the seasonal ports have changed, not one per port (each port still goes to the
  news); the 14-day announcement only alerts companies with a ship at, bound for, or planned for that port. The Northern Sea Route is only routed
  when safe (never a gamble); seasonal ports may be a gamble, with the risk shown.
- Dark jobs (owner's choice: "insane advantage, but tarnish forever"): very high pay is
  balanced by permanent infamy (reputation cap → fewer premium contracts, dearer credit),
  tougher customs (impoundment), seizure risk on refusal (ransom or abandon, rule 2) and
  a gang grudge shown on the map. People smuggling, not human trafficking (store policies).
  Aftermath news never names real groups. Winks at real brands only on reliable shippers.
- Map/routing: `tools/build_world.mjs` opens three Arctic corridors north of 66° N
  (Barents–Kara, Northern Sea Route marked as canal `nsr`, Chukchi–Beaufort); the rest
  stays pack ice. Distance tables store closed-passage cases as diffs.

### Final balance pass (done) — targets to preserve

Full results and their history: `docs/balance/history.md` (add new runs there, not here). Targets: population runs
(5 years, 96 companies) with no bankruptcy and every home port viable; no strategy dominant over 16 seeds (each wins
some markets); every ship model profitable; AI-only victory games won about half the time, first victory around
year 9–10, no victory path dominating; 10-year runs: all AIs survive.

- Lessons: used-ship prices must follow earning power (slow `AGING.dep`),
  otherwise cheap old hulls give runaway returns; the AI must price expected
  embargo fines (it now does, `embargoCost` in `ai.js`) or it bleeds billions.

## Conventions

- **Code health (read `docs/code-health.md` before adding a helper, a setting or a saved field):** sums and
  percentages through `sim/format.js` (`money`, `num`, `pctOf`…), money booked with `book(state, …)`, storage only
  through `ui/storage.js`, a new saved field gets a default in `fillDefaults` (`sim/migrations.js`) and released
  saves in `tests/saves/` must keep loading, no dead exports or imports. `node tools/code-check.mjs` (npm test, CI)
  enforces the mechanical rules.
- In-game text is French; code comments in French.
- English option: French stays the source language in the code. `web/js/i18n.js`
  translates every French text as it reaches the screen (DOM text nodes and
  title/aria-label attributes via a MutationObserver; map canvas labels via `tr()`),
  using the dictionary `web/js/i18n/en.js` (French text → English, `{0}` for
  variable parts, which are translated recursively). Whenever you add or change a
  French UI/news text, add its English entry, then run `node tools/i18n-check.mjs`
  (also part of `npm test` and CI): it fails while any code text, or any text a 2-year
  game produces (notifications, news, logs, with trap ship names), still shows French in
  English. The translator only sees whole text nodes: a template whose variable part is a
  French fragment (`…${x}${glace ? ' (classe glace)' : ''}.`) is recomposed with each fragment
  and must translate too, and French text glued with `+` is refused (write a template or
  separate text nodes). `node tools/i18n-screens.mjs` (Playwright, not in CI: run at release, part of `npm test`)
  plays a 2-year game in English in a hidden browser, opens every panel, tab and event
  window, and fails on any French actually on screen (runtime-glued pieces, lone words,
  status labels, French around names in `data-no-tr`). Proper names and never-shown texts go in `tools/i18n-ignore.json`. In French, the
  screen contracts generated text around names (`frenchGrammar` in `i18n.js`: « à Le Havre » → « au Havre », « du Écume » →
  « de l'Écume »): write templates plainly (`à ${port}`, `du ${ship.name}`), never pre-contract them. Ship,
  company and captain names are registered at runtime (`registerGameNames`) and treated
  as untranslatable tokens, so any player-typed name works inside a sentence. Served on
  localhost or with `?dev`, the game warns in the console about every text still in
  French (`window.__i18nMissing`). Mark an element `data-no-tr` to leave it untouched.
- Vanilla JS ES modules, no build step (`web/`), Android WebView wrapper in `android/`.
- Interface size (`web/js/ui/scale.js`, owner's pick): one reference format, 16:9 at 2560 × 1440 (the owner's screen); check
  every screen change there first, then 1920 × 1080, 2560 × 1600 (16:10) and 3440 × 1440 (21:9). The page is zoomed by
  `uiScale()` = the largest 16:9 that fits the screen (the code counts in 1920 × 1080 px: 1 at 1080p, 1.33 at 1440p), never
  below 0.75 on small screens (`MIN`), adjustable in the ☰ menu. On other shapes the interface keeps that 16:9 size, anchored
  to the edges, and the map fills the rest (no black bars); dialogs and scenes stay centred cards of bounded width. Write `calc(N * var(--vw))` / `var(--vh)` instead of `vw` / `vh`, convert screen coordinates with `localRect()` /
  `viewport()` before positioning an element, and size a canvas with `pixelRatio()`; the map stays `.unzoom` and scales its own drawings.
- Ship art (owner's pick): hand-pixel look, drawn procedurally from `SHIP_ART` (`ui/shipshapes.js`, proportions in metres, beam `B`). Detail
  views (inspect, ship sheet, broker cards, thumbnails) use `ui/pixelship.js` (a `<span class="px-ship">` that gets a
  canvas, slot `big` animated at 8 fps); the map uses side-view sprites from `ui/mapships.js` (laden = company hull,
  empty = pale hull with a company stripe, wake length follows speed, routes dashed in the company colour). Two styles,
  fine (default) and chunky, switched in the ☰ menu (`pda-ship-style`); both must keep working. Event scenes (owner's pick)
  draw the player's real ship, always chunky, to scale on the 200 × 112 scene grid (0.55 px per metre: a coaster stays
  small, a Capesize fills the frame, a giant overflows), anchored by the bow, slopes by shifting pixel columns, never
  rotating (`sceneShip` / `sceneShipOf` in `ui/sceneship.js`; scenes with no ship of the game use a stand-in model).
  The level-up, record and misdeed scenes paint the pixel office (`ui/officescene.js`). Map sizes (owner's pick): ships ×1.5 and port names 13 px
  at 1920 × 1080, times `uiScale()` (`MAP_SHIPS`, `CITY_PX` in `mapships.js`); port names are drawn over the ships,
  under the selected ship and the dock badges; chunky blocks stop at 3 screen pixels.
- Guided tour (`web/js/ui/guide.js`): bubbles point at real buttons through stable markers
  (`data-guide="buy|accept|dest|sail|collect"`, panel tabs' `data-tab`, rail `data-panel`).
  Keep these attributes when reworking those buttons, or the tour silently loses its targets.
- Office keeps 4 tabs (Finances with insurance at the bottom, Résultats, Compagnie, Chargeurs). Each victory has a
  medal button under the side rail (🚩 🌟 🏆 🗡, own colour, progress ring around it) (`.vic-rail`, `data-victory`) opening panel `victory` with tabs: `course` plus
  domination → `concurrents`, `classement`; reputation → `hauts-faits`; legend → `records`; shadow → `mefaits`.
  The reputation star ★ is always gold (`--star` / `.star` in `style.css`).
- Logo (`web/js/ui/brand.js`, owner's choice): the sunset-anchor seal crowning a sea-chart plaque, name in Stardos Stencil
  (`web/fonts/`, OFL), tagline "Your fleet awaits, Captain" in English in both languages. One master anchor (`anchorShapes`)
  for the logo, app icon, cursor stock and Steam assets; the "Ancre" company emblem (`logos.js`) is a separate drawing.
  Title card, intro and credits draw the plaque with `brandTitle` (`data-no-tr`). Icons and the logo-only Steam assets are
  made by `node tools/brand/render.mjs` (Playwright, not in CI) into `web/icon.svg`, `web/icons/` and `store/`
  (`store/README.md` says which file goes in which Steamworks slot). Ask the owner for direction before drawing new art.
- End credits (`web/js/ui/credits.js`): film-style roll on `musique/generique.mp3`, every game animation fading in
  and out around it (captions use the player's own figures), after the victory screen and from the title screen.
  `AUTHOR` holds the name shown for the author; add a scene to `NOT_ALONE` if it cannot draw without game data.
- Icons (owner's pick, "smooth" style: ink outline, flat fill, one shade, one highlight): the code keeps its emoji and
  the colour font `web/fonts/pda-icons.woff2` (COLR, `unicode-range` limited to the game's emoji) draws each one in the
  game's style, in the DOM and on the map canvas. Every font stack starts with `var(--icons)`, every map `g.font`
  with `PdaIcons`. Drawings in `tools/icons/` (`cps.mjs` says which emoji each replaces), built by
  `node tools/icons/build.mjs` (Python fonttools, picosvg, skia-pathops). `node tools/icons-check.mjs` (npm test, CI)
  fails on any emoji without a drawing: draw it, or list it in `TEXT_GLYPHS` if it should stay plain text. Sizes: 16 px
  in 14 px text, 32 px drawings at 28 px (rail, goods tiles). Goods are grouped by ship on shelves (Markets → Goods).
  Ask the owner for direction before adding a new family of drawings.
- Original game only: never reuse the name, art, music or screens of
  *Ports of Call*; keep only the general mechanics.
