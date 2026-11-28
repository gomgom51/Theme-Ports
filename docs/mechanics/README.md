# Port d'Attache — mechanics reference (read this first)

This folder maps every game mechanic in the code, what drives it, and what it touches.
It exists so that a new task can start here instead of re-reading 30 simulation modules.

- **Code language**: identifiers, comments and in-game text are French. These docs are in English
  and quote the French identifiers exactly (`changeTrust`, `HOME.family`, `'détention'`…).
- **Source of truth**: the code. Every section names its file(s); constants are quoted as of the
  commit that last touched these docs. When you change a mechanic, update the matching file here
  (and the design notes in the root `CLAUDE.md` if it is a balance lesson).
- **Design rules** (owner's, in `CLAUDE.md`): no hidden crucial risk (rule 1), no forced chores
  (rule 2), no dominant strategy (rule 3), choices not traps (rule 4). Don't balance while building.

## Files

| # | File | Covers | Main code |
|---|---|---|---|
| 01 | [architecture.md](01-architecture.md) | Folder layout, game loop order (hour / day / month), state shape, `ctx`, RNG, saves, notes to the UI, UI and i18n map, tests and tools | `sim/game.js`, `sim/context.js`, `sim/util.js`, `main.js`, `ui/*` |
| 02 | [ports-and-flags.md](02-ports-and-flags.md) | The 66 ports and 51 flags: fields, tables, lists (embargoed, enforcing, shady, strict, image, seasonal) | `data/ports.js`, `data/sanctions.js` |
| 03 | [home-ports.md](03-home-ports.md) | Home port = flag; the four home-port perks (shadow, financial hub, winter, family first), shadow lender, embargo takeover fine, relocation, start ports, the 36 ports with no perk | `sim/home.js`, `actions.relocate` |
| 04 | [economy-market.md](04-economy-market.md) | Goods, world prices, local prices and stocks, freight cycle, fuel, repairs, ship values, running costs, handling | `sim/economy.js`, `data/goods.js` |
| 05 | [contracts-clients-payments.md](05-contracts-clients-payments.md) | Contract generation and pay formula, golden deals, reservations, shippers (reliability, loyalty, grudges, image), payment resolution and disputes, prospecting | `economy.makeContract`, `sim/clients.js`, `sim/payments.js`, `sim/prospect.js` |
| 06 | [trade-tenders-finance.md](06-trade-tenders-finance.md) | Buying and selling cargo (quantity slider), city tenders, cargo loans, price guarantee, intel estimates (best deal, sources, outlets) | `actions.buyCargo/sellCargo`, `sim/trade.js`, `sim/intel.js` |
| 07 | [ships-crew-equipment.md](07-ships-crew-equipment.md) | 22 ship models, used market, new builds and yards, sale, lay-up, crew levels and XP skills, equipment | `data/ships.js`, `sim/crew.js`, `sim/equipment.js`, `data/equipment.js` |
| 08 | [voyages-routing-ice.md](08-voyages-routing-ice.md) | Planning a voyage, routing and distance tables, canals, the hourly sailing step, arrival sequence, seasonal ice and the Northern Sea Route | `actions.planVoyage`, `sim/routing.js`, `sim/ice.js`, `game.sailHour/arrive` |
| 09 | [sea-risks.md](09-sea-risks.md) | Incidents, sinking, wear, port-state inspections and detention, insurance, pollution, piracy, coastguard patrols, storms | `sim/incidents.js`, `sim/insurance.js`, `sim/pollution.js`, `sim/piracy.js`, `sim/patrols.js`, `sim/events.js` (weather) |
| 10 | [world-events.md](10-world-events.md) | Random world events (oil shocks, refinery crisis, canals, strikes, recession…) and disasters that spawn aid contracts | `sim/events.js`, `dark.darkDaily` |
| 11 | [grey-black-trade.md](11-grey-black-trade.md) | Embargo taint and sanctions fines, discreet parcels and customs, bribes, dark jobs, gangs' trust and grudges, seizures, aftermath news, blacklist | `sim/shady.js`, `sim/dark.js`, `sim/shadow.js`, `data/sanctions.js` |
| 12 | [finance-bank.md](12-finance-bank.md) | Cash, books, debt, credit limit, interest rate, overdraft, bank seizure, bankruptcy, taxes, net worth, shadow lender | `sim/core.js`, `game.checkBank/monthly`, `actions.borrow/repay` |
| 13 | [reputation.md](13-reputation.md) | Trust 🤝 and virtue 💚, caps, infamy, every source of gain and loss, who reads what | `sim/core.js` (standing), all callers |
| 14 | [rivalry-takeovers.md](14-rivalry-takeovers.md) | Shady deals (pirates, corruption, poaching, intel, tip-off), rivalry attacks and parries, takeovers and bids | `sim/plots.js`, `sim/takeover.js` |
| 15 | [victories-honours.md](15-victories-honours.md) | Office levels, deeds, records, misdeeds, the four victories and their alerts, end of game | `sim/victory.js`, `sim/honours.js`, `data/offices.js` |
| 16 | [ai.md](16-ai.md) | How AI companies decide (ship idle loop, daily fleet/treasury, leanings), every AI-only knob | `sim/ai.js` + AI branches elsewhere |
| — | [../balance/README.md](../balance/README.md) | Balance simulation: comparing two versions of the game on the same seeds (population, strategies, fleet, victories) | `tools/balance/compare.mjs`, `tools/balance/population.mjs` |

## How the systems connect

```
                         ┌──────────────── world events (10) ──────────────┐
                         ▼                                                 ▼
 ports & flags (02) ─► economy / market (04) ──► contracts (05) ──► voyages (08) ──► arrival
        │                    │    ▲                  ▲   │              │              │
        │                    ▼    │                  │   ▼              ▼              ▼
        │             trade, tenders, loans (06) ◄───┘ payments    sea risks (09)   inspections,
        │                    │                         & shippers   incidents,       customs, gangs,
        ▼                    ▼                             │        piracy, ice      sanctions (11)
   home-port perks (03)   bank & finance (12) ◄────────────┴────────────┴──────────────┘
        │                    │ ▲                                         │
        ▼                    ▼ │                                         ▼
   AI leanings (16)     net worth ──► office level ──► takeovers (14) ◄── reputation (13)
                             │                │                              ▲   │
                             ▼                ▼                              │   ▼
                      victories & honours (15) ◄─────── deeds/records ───────┘  credit, contracts,
                                                                                  loans, prospecting
```

Key cross-links (each is explained in the target file):

| Driver | Feeds into |
|---|---|
| **Flag** (`company.flag`, from the home port) | tax (monthly), crew wages, new-build subsidy, starting trust/virtue (`rating`), bank `rate`, embargo stance (`ENFORCING`), AI `avoidsEmbargo` |
| **Trust** (`confidence`) | contract `minRep`, shipper `clientRep`, payment dispute odds, arbitration, credit limit, interest rate, cargo-loan LTV and access, prospecting odds, takeover price, financial-hub discount, reprieve odds |
| **Virtue** (`virtue`) | reputation victory, image shippers' pay (`imageFactor`), inspection odds in image ports (`inspectVirtueK`) |
| **Infamy** (`company.infamy`) | caps both scores (`trustCap`/`virtueCap`), blacklist at 80, "Le Juste" deed impossible, takeover inheritance |
| **Net worth** (`netWorth`) | office level → takeover eligibility, attack `minLevel`, reputation victory level, prospecting; cargo-loan cap; AI embargo-fine ceiling; takeover price; family-first "biggest rival" |
| **Ship condition** | incident rate, sinking, speed, inspection/detention, insurance validity (`SEAWORTHY` 40), ship value, AI repair decisions |
| **Embargo taint** (`ship.taint`) | sanctions fine on arrival in an enforcing port; feeds "Briseur d'embargo" misdeed |
| **Gang trust** (`company.trust[port]`) | unlocks dark-job offers (≥ 2 parcels from that port); shadow home port starts at 2 |
| **Seasonal ice** | contract availability, escort fees, NSR routing, used market (no listings in ice) |
| **World events** | world prices, freight, cycle, ship index, canals, strikes, oil-crisis contract purge |

## Where do I change…? (quick lookup)

| Want to change | Go to |
|---|---|
| A port's goods, draft, terminals, repair yard, fees | `web/js/data/ports.js` (then `npm run build:distances` if coordinates change) |
| A flag's tax / wages / loan rate / rating | `FLAGS` in `web/js/data/ports.js` |
| Home-port perks (lists, discounts, fines) | `HOME` in `web/js/sim/home.js` |
| Which countries are embargoed / enforce / are shady | `web/js/data/sanctions.js` |
| Freight pay level | `BALLAST`, `BALLAST_HOLD`, `FREIGHT_*`, `CYCLE` in `sim/economy.js` |
| Trade margins | `SPREAD`, `goodSpread`, `GOODS[].spread` |
| Bank: credit limit, overdraft, seizure | `creditLimit`/`interestRate` in `sim/core.js`, `checkBank` in `sim/game.js` |
| Reputation sources | `VIRTUE_SOURCES`, `STANDING`, caps in `sim/core.js`; per-event deltas at the call sites listed in [13](13-reputation.md) |
| Incident / inspection / sinking rates | `RISK`, `INCIDENT_BASE`, `STRICT_FLAGS`, `IMAGE_PORT_FLAGS` in `sim/incidents.js` |
| Victory thresholds | `VICTORY` in `sim/victory.js`, `HONOURS` in `sim/honours.js` |
| AI behaviour | `sim/ai.js` (+ `aiTakeover` in takeover.js, `aiPlots` in plots.js, dark-job AI in dark.js) |
| Player-facing text | French string in code + English entry in `web/js/i18n/en.js`, then `node tools/i18n-check.mjs` (fails on any French left in English, glued fragments included) and `node tools/i18n-screens.mjs` (same, on the real screens) |

## Glossary (French identifiers)

| Code | Meaning |
|---|---|
| `confidence` / `virtue` / `reputation` | trust / virtue / min of the two |
| `trust[port]` | gangs' trust per port (not reputation!) |
| `infamy`, `blacklisted`, `crossed` | dark-job stain, international blacklist, has done a dark job |
| `taint` | embargo mark on a ship (365 days) |
| `contraband` / `dark` | discreet parcel on board / full dark cargo on board |
| `busyWhat` | port activity: `chargement`, `déchargement`, `réparation`, `détention`, `saisie`, `retenue`, `otages`, `confisqué`, `recrutement`, `réarmement`, `installation`, `démarchage` |
| `status` | `port`, `sea`, `laidup` |
| `plan` | queued departure `{to, speed, autoRefuel}` |
| `pendingDelivery` | contract id waiting for unloading to finish |
| `hon` | honours counters (deeds, records, misdeeds) |
| `leaning` | AI temperament: `batisseur`, `vertueux`, `conquerant`, `ombre` |
| `portKind` | home-port perk: `ombre`, `place`, `hiver`, `famille` |
| `negoce`, `fret`, `sinistres`, `discret`… | accounting books (`BOOK_LABELS` in `core.js`) |
| `queuedNotes` | UI notifications produced outside the daily `notes` array, flushed by `plotsDaily` |
