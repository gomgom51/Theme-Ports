# Changelog

What each release changes for players, newest first. Every release bundle adds its entry here, bug fixes
included (owner's rule, 2026-11-28). Releases before v0.010 are listed by their bundle PRs in git history.

## v0.010 (bundle 10)

### New

- **Standing orders** (Set sail card, ship's Ordres tab):
  - **↻ Regular line:** the ship shuttles between two ports on its own. It takes the best contract or a trade
    cargo each way and repairs below 60 %. Needs a confirmé crew or better with all 6 XP points.
  - **🧭 Captain's choice:** the captain picks contracts and cargo within limits you set. Needs the vieux briscards
    crew and costs a small daily fee: 3 × one veteran sailor's wage.
  - A ship on orders calls you and waits whenever a risk you did not see appears, the margin turns negative or cash
    runs short. Payments always stay yours to cash in.
- **Fewer interruptions:**
  - No idle stop for ships on orders.
  - No "arrived and unloading" toast; the sound stays.
  - Rivals' tender news only for the tenders you follow.
- **Tab** / Shift+Tab opens the next ship waiting for orders.

### Bug fixes

- **The Encaisser button did nothing on some payments** (v0.009 regression). It happened when a shipper disputed
  the payment and the delivering crew was experienced (level 1 or more). The cash-in window crashed, so the payment
  stayed in the fleet and office lists, even after reloading. Such payments now cash in normally: stuck saves fix
  themselves.
  - Cause: the clean-up removed a small number-formatting helper (`fr`) that the crew changes, merged right after,
    still called in `oddsWords` (`ui/risk.js`).
  - Guard: `tools/code-check.mjs` rule 6 now fails on any call to the removed format helpers.
- **"N for this ship" on the Set sail list over-promised** (older bug). The count included contracts the ship would
  be refused on arrival (trust or shipper requirement, reserved contract, ice class, closed port) or that expire
  before it gets there. It now uses the same rules as the Contracts tab (`checkContract`), plus the expiry date.
- Two duplicate English translation keys removed (`{0}/j`, `coupé`). On screen, "/d" stays as before.
