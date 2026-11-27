# PR 5 (cranes, single-hull checks, switchable transponder) and PR 7 (oil virtue at departure): player impact

Full suite, same seeds, main 44b3292 vs PR 5 3ab63c3 vs PR 7 c8b4701 vs both merged. Details: [report.md](report.md).

**Noise floor.** PR 7 only moves the oil virtue loss from delivery to departure (same amount), yet it shifts
population medians by ~8 % and single categories by up to ±40 % through reshuffled games. Only effects larger than
that, or seen in the deterministic fleet test, are real.

Clear effects (fleet test: one ship alone, neutral market, no reshuffle):
- Old single-hull tanker: 7.0 → 2.9 M$/year (−59 %), still profitable. In the AI population, 5.0 → 3.0 M$ per
  ship-year, loaded 49 % → 41 % (the AI avoids strict ports with it rather than risk the 49 % fine). The AI keeps
  buying it (75 → 77 hulls): cheap entry, now clearly the weak tanker.
- Ships with cranes: multipurpose cargo +17 %, Handysize +12 %, Supramax +12 %; old cargo −0.3 M$ (−9 %), small
  coaster, heavy-lift unchanged (they already used small ports at their own pace, or rarely call there).
- Switchable transponder: no measured effect, because the AI never switches it on. Only a human player will use it.

No correctness problems: no NaN, 0 bankruptcies on main, PR 7 and both merged; 1 on PR 5 alone (a shadow company,
Santos, seed 13), not repeated when both are merged.

Inside the noise (do not act on these yet):
- AI population median ×26 (main), ×24.8 (PR 5), ×24.0 (PR 7), ×20.5 (both). Bottom 10 % unchanged (×4.6–6.5).
- Strategy test: tankers led main (7 of 16 markets) and lose the lead in every variant, PR 7 included; liners
  reach 8 of 16 with PR 5 (rule 3 limit: 10). Watch at the final balance pass.
- Victories: 8–11 of 16 games won, median 10.3–10.9 years in all four versions (target ≈ 10 years).
