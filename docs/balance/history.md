# Balance results: history

Moved out of `CLAUDE.md` on 2026-11-28 so every thread doesn't load past run results. The targets they set are
summarised in `CLAUDE.md` ("Final balance pass"). Add new results here, newest at the end; how to run and read the
tools: [README.md](README.md); full reports: [reports/](reports/).

## Final balance pass and later runs

- AI population, 5 years, 96 companies: median ×8 net worth, bottom 10 % ≈ ×1,
  no bankruptcy; every home port viable (Houston/US flag lowest, ×3–8 median).
  After the owner's 6-hour playtest ("money is slow"), deliberately faster: median
  ≈ ×19, bottom 10 % ≈ ×4, best ≈ ×54, Houston ×13 (trade, golden deals, crew skills).
  Strategies then: bulk 8, liners 4, tankers 3, cargos 1 over 16 seeds; fleet OK.
- 10 years: all AIs survive, growth turns linear once the fleet cap is reached.
- Strategies over 16 seeds: bulk 7 wins, tankers 5, liners 3, cargos 1 (cargos'
  edge is grey/black trade, which the test bots barely use); medians ×13–24.
- Fleet test: every model profitable.
- After tenders, cargo financing and prospecting (5 years, 96 companies): median ×29, bottom 10 % ×6.7, best ×85,
  no bankruptcy; Houston (US flag) lowest at ×19, Singapore highest at ×46. Faster than before (×19): trade now
  pays, as the owner asked, and cash-rich companies fill every hold once their fleet is capped. No trade knob
  slows it much (tender premium, loan share, exposure cap, `SPREAD` each move it by less than the seed noise);
  `BALLAST` 1.6 gives ×26 but drops the bottom 10 % to ×3. Strategies over 16 seeds: tankers 7, liners 5,
  cargos 2, bulk 2, medians ×36–61. Fleet test OK. 10 years: all AIs survive, linear growth once capped.
- Victories (16 AI games, 14 years, one company per leaning): 10 games won, median first victory 9.5 years, 7 before
  year 10; reputation 5, shadow fleet 3, legend 2 (owner's call: shadow felt weak, reputation too resilient, fixed with
  the six-month hold, shell companies, 7 years / 16 ships on the blacklist); domination is the hardest (conquerors
  usually eliminate one rival, never all three). After the new Clean Seas (no polluting cargo for 4 years) and the rule that a
  blacklisted buyer can only buy blacklisted companies: 9 won, median 9.5 years, 6 before year 10; reputation 6, shadow 2,
  legend 1 (same seeds: a shadow fleet that used to win at 9 years is now dismantled first, a legend at 13.5 years slips past 14). After the trust/virtue split (economy on
  trust, virtue for the reputation victory, image customers and ports): 9 won, median 9.9 years, 5 before year 10;
  reputation 5, shadow 3, legend 1. Population: median ×36, bottom 10 % ×9.6, no bankruptcy, 13 bought (mostly shadow
  fleets). Strategies: tankers 8, liners 4, cargos 2, bulk 2 (tankers led in every run since the split: watch rule 3).
  First tries with the economy reading the minimum of the two scores crushed every risk-taker (bottom 10 % ×2.5,
  conquerors bought in 13 of 16 games): the economy must read trust only. With oil costing virtue: victories 4 of 16, median
  13.3 years, reputation 1 (the virtuous AI carries oil like everyone, so it rarely gets there; a human chasing that
  victory would avoid oil); strategies tankers 7. With the refinery crisis (2 to 4 weeks): victories 6, median 9.8
  years (legend 3, shadow 2, reputation 1); strategies tankers 7, bulk 5, liners 3, cargos 1, tanker median ×57 → ×50
  (a short crisis trims tanker income but does not change which strategy tops a market). Then the virtuous AI avoids oil
  (35 % of an oil job's revenue counted as an image cost, no oil or chemical tankers bought: `VIRTUOUS_OIL_PENALTY` in
  `ai.js`), as a human chasing that victory would: victories 7 of 16, median 9.5 years, 5 before year 10; reputation 3,
  legend 3, shadow 1 — no path dominates (reputation was 5–6 before the split). One shadow AI went bankrupt. A shadow fleet that survives wins; its survival hinges on
  `TAKEOVER.dismantleK` (×1 → 2 wins, ×1.5 → 2, ×2 with 6 years → 6, ×2 with 7 years → 3). With leanings: population survivors median
  ×27, bottom 10 % ×10, no bankruptcy; most shadow fleets are bought or dismantled within five years. Strategies over
  16 seeds (neutral leanings, victories off): tankers 5, cargos 4, bulk 4, liners 3. Fleet test OK.
