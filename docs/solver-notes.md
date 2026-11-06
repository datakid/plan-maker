# Solver plan notes

## Phase 1
- cmpScore and isPerfect route every score comparison; LNS keeps a tuple key per iteration, so intent can no longer be traded for soft.
- One rng in core.js. anneal.js was not loaded anywhere and is removed.
- Golden plans: 36 of 36 identical.

## Phase 2
- No engine loop reads the clock. budgetFor(span, quality, size, scale) returns layoutLoops, teamNodes, layoutEvals, lnsIters, descentEvals, polishIters, explainProbes and explainMoves.
- The only clock reads left are genrun.js and worker.js, which pass an abort guard; a fired guard marks the result truncated.
- Golden plans: 36 of 36 identical. Seed quarter (T8): soft 57.67 to 62.67 because quarter polish iterations are 500 instead of 1000 until Phase 3 makes evaluation incremental.
- Iteration caps measured at about 750 layout evals/s and 1000 LNS iterations/s on the development machine.

## Phase 3 (partial)
- validatePlan accepts opts.memo; the per-visit block is cached by visit content and replayed, and each search state owns its memo. The seed quarter runs about 1.5x faster; golden plans 36 of 36 identical.
- R-SOL-12 checks the incremental tuple against a fresh validatePlan after 600 random moves.
- Not done: day, week, person, goal and preference sections still run in full on every delta (about 7 ms per evaluation on 70 visits), so the 5x target is open.

## Phase 3b
- scope.js caches pure helpers (availability, off-days, travel km, workday, active people) for the length of one lnsPlan, searchPlan or explainPlan call and clears them afterwards; R-SOL-13 checks equality with the plain helpers.
- Profile of one evaluation on the seed quarter: collectPreferences 26%, planTally with goals 18%, ctxTally 11%, per-visit block (memoized) and day/person loops the rest. These global sections are what remains before the 5x target.

## Phase 3c
- The goal tally context lives on the search state and is updated in applyMove with tallyVisit (same pattern as busyIdx); validatePlan reuses it through opts.tally, and lnsReindex rebuilds it. R-SOL-12 covers equality after 600 moves.
- Seed quarter: 346 evaluations went from 2.63 s to 2.17 s across the three steps (about 1.2x on top of the visit memo). Remaining profile: collectPreferences 30%, evaluateGoals 18%, validatePlan's own day and person loops the rest.

## Phase 4 (operators in, off by default)
- lnsPlan options: ruin (Rweek and Rdays ruin-and-recreate moves, one Hungarian over every freed seat of one pool), adaptive (ALNS weights with 33, 9 and 13 scores, reaction 0.1 every 100 iterations) and scaled (acceptance list clamp(V, 50, 1000), kick after max(400, 10V)).
- Benchmark at equal iterations (month 500, quarter 400, five seeds each, plus g4i2 and spx fixtures at 1200, 34 runs): the best variant matched the old search (summed month and quarter soft 421.8 against 419.8); adaptive weights, scaled acceptance and a larger ruin share each came out worse (429 to 454). The 90% target is not met at these budgets, so the default mix is unchanged and golden plans stay identical.
- Revisit once evaluations are several times faster, since ruin moves need longer runs to pay off.

## Phase 5 and 6 (partial)
- generatePlan({warmFrom}) keeps the previous plan's visits that still fit the new data (day in frame, facility still schedulable, people still active), compares that start with the fresh draft under cmpScore and keeps the previous plan on ties so visit ids stay stable; the search then repairs from there. The fresh layout still runs, so this is a quality and stability gain, not the under-300 ms regeneration.
- lnsSeatPolish is a deterministic best-improvement pass over every visit, pool seat and eligible person (at most 8 passes, evaluation-capped); lnsPlan({polish:true}) runs it after the descent, and continueSearch uses it.
- Not done: NGoal targeted moves, open-seat bias, the single eligibility module (S9), solveTeams warm assignment, exact per-term explain, min-cut explanations and the intent lower bound.

## Phase 7 (partial)
- intentBound (solver.js) is a max-flow of special-goal copies onto workdays with the per-day cap and fixed visits already taking capacity; generatePlan reports search.lowerBound {intentUnits, requested}, search.intentUnits, and search.optimalOnIntent (hard-clear and at or under the bound). The bound ignores people and volume totals, so it is a relaxation and stays sound.
- xPoolSeatsHigh lines now carry cut {flow, days, people}: a pool max-flow from people (capacity) through available days to seat needs, naming the days left short and the people who could cover them with how much of their capacity is used. maxFlow takes an optional out object with reach and per-edge flow.
- Not done: the same cut on xPoolDayShort, and the status pill wording (UI, separate PR).

## Phase 3d
- scope.js stores are per function with two-level keys for person-by-day helpers, and also cache dayRuleOf, poolsLive and distBand. One validatePlan evaluation on the seed quarter went from 7.6 ms to about 4.2 ms (1.8x overall); the 5x target is still open.
- Quarter polish iterations are back to 800. Seed quarter: 3.2 s with soft 57.67, against 6.4 s and the same soft score on main.

## Phase 5.3 on by default
- Benchmark, 10 seeds each of month (500 iterations) and quarter (400), 20 runs per variant: seat polish 19 better, 0 worse, summed soft month 441.7 to 420.7 and quarter 694.0 to 628.7. Ruin, ruin and scaled, and adaptive weights stayed neutral or negative (7 to 9 better, 9 to 11 worse), so they remain opt-in.
- The generate polish stage now runs lnsSeatPolish after the descent. Golden plans: 34 of 36 identical; plain-seed-week seeds 1 and 2 improved in soft (4.665 to 2.665 and 8.665 to 4.665), none worse, re-baselined.
- generatePlan({lnsMode}) passes options to the polish stage's lnsPlan.

## Moves and filters (final)
- lnsGoalMove (group NGoal, option goal) targets short cover and at-least goals by inserting a visit of a missing in-scope facility, paired with a removal when the count is exact. Open-seat bias (option openBias) picks visits with unfilled seats 30% of the time and fills them (N3fill). Benchmarked on 20 runs: goal moves 10 better and 5 worse (month 420.7 to 404.7, quarter 628.7 to 625.3), open-seat bias 7 better and 10 worse; both stay opt-in.
- Move filters on by default: N4day and the descent skip days already at capacity (154 of 154 N4day evaluations broke a hard rule on the seed quarter), and every team change is skipped when it would take a visit from having a qualified senior to having none. Share of evaluated proposals that worsen hard fell from 37% to 5% on the seed quarter. 20-run benchmark against the previous default: month soft 420.7 to 394.7, quarter 628.7 to 652.2 (noise level), 10 better, 8 worse.
- solveTeams takes opts.prefer (date, facility, person triples) and tries those candidates first, ordered by index so the combination search can reproduce them; generatePlan passes it only with warmFrom. R-SOL-21 covers reproduction.

## Explain and eligibility
- explainPlan ranks each fix by the (hard, intent, soft) tuple, breaking ties by fewest side effects, and reports delta [hard, intent, soft] and the tier of every side effect (hard, intent or soft). Probing still starts with hard then intent violations.
- R-SOL-23 checks every eligible replacement the moves can propose on the seed month plan: with the senior pre-filter, none adds a hard violation (without it, 48 of 572 did, all dSenior).

## Shared eligibility and day cut
- lnsEligibleKeep (lns.js) is the one candidate filter for seat replacements: the rule check plus keeping a qualified senior on the team. Swap, fill, replace, polish and explain all use it. R-SOL-23 checks every offered replacement against the validator on the seed month plan.
- xPoolDayShort lines carry cut {need, people, short}, the day-level counterpart of the seat cut.
- Golden re-baseline (soft only, hard and intent unchanged): plain-seed-week seed 1 2.665 to 4.665, seed 2 4.665 to 2.665, seed 3 2.665 to 4.665.
