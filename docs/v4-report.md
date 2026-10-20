# al-Khitta 4.0 final report

Branch `v4`, one commit per phase (0 to 7; phase 8 is this documentation commit). Cleanup edits that touch code (unused definitions removed, polish made iteration-bound) are in the phase 7 commit.

## What was built

| Phase | Result |
|---|---|
| 0 | Baseline numbers (`docs/v4-baseline.md`), fixture `Fx.w1`, bug reproduced: 50 of 153 random lean setups missed a lean day |
| 1 | `js/rules-model.js` registry (44 rules, 8 structural), `RULES_REV` 8 migration, `LevelChip`, `AlwaysTag`, migration tests |
| 2 | Unified evaluator: `validatePlan` tags rule, level, weight, units; `hardScore` and `softScore`; `js/score.js` (preference scoring, state, move apply/delta/revert, due reward); every rule flipped between Must and Prefer in tests |
| 3 | `js/flow.js`, `js/assign.js`, `js/layout.js`, `js/lns.js`, new proofs, `plan.targets`, pipeline in `planner.js`; `js/anneal.js` deleted |
| 4 | LevelChip on every rule in the Rules tab, weekday table, person editor, facility sheet, goals, plan strip; old Must/Try, rigid/flexible and light/medium/strong controls removed |
| 5 | Editable People table, docked panel, keyboard navigation, bulk bar with undo, narrow-screen sheet with prev/next |
| 6 | Goals manager (Rules tab, wide sheet, person popover deep link) |
| 7 | `js/explain.js`, `plan.why`, rule contributions in the Summary and the visit sheet, README 4.0 |

## Test results

`test.html` in headless jsdom 30 (Node 22): pass=235 fail=0, no uncaught page errors, no-comments check clean. Baseline before the work was pass=167.

| Test | Result |
|---|---|
| T1 | W1 contracted on Tuesday 20/20 with day.kind Prefer (weight 8) and Must; 0 hard violations |
| T2 | two lean days both filled 20/20, Prefer (weight 8) and Must |
| T3 | Must contracted Tuesday with exact 5 basic / 0 contracted: `infeasible`, conflict names `day.kind` and `vol.exact` |
| T4 | favoured category 20/20, Prefer (weight 8) and Must |
| T5 | solver score equals `validatePlan` on 200 random fixtures (`plan.gen.search.score`) |
| T6 | 30 small fixtures: generator at least as good as the exhaustive reference in 30/30 (identical in 21; better in 9 because the reference enumerates a narrower space); 12 fixtures have a valid reference plan and the generator found a valid plan in all 12 |
| T7 | same input and seed give an identical plan |
| T8 | week, month and quarter inside the budgets with 0 hard violations |
| T9 | raising a Prefer weight (1, 5, 10) never increases that rule's units in the reference optimum, for day.kind and day.category |

At the default weight of 5 the original lean scenario (153 random setups) now misses 0 times. T1, T2 and T4 use weight 8 for the Prefer variant because at equal weights the optimiser may legitimately trade one unmet day rule for a larger fairness or due-priority gain.

## W1 before and after

| | Before | After |
|---|---|---|
| Plain W1, Tuesday contracted, 20 histories | 20/20 | 20/20 |
| 153 random lean setups (seeded histories, up to 2 contracted and 3 basic lean days) | 50 setups with a missed lean day (32.7%); 53 of 424 lean days (12.5%) | 0 setups; 0 of 424 lean days |

## Performance (seed data, full pipeline, jsdom)

| Window | Before | After | Budget |
|---|---|---|---|
| Week | 22 ms | 106-197 ms | 400 ms |
| Month | 24 ms | 483-594 ms | 1.5 s |
| Quarter | 49 ms | 1.5-1.7 s | 5 s |

The extra time is the LNS polish and the explanations; the old draft path produced plans that did not honour weekday rules.

## Tests whose expectation changed

See `docs/v4-notes.md`: L7 witness plan (fairness is now scored), L9 and L10 (annealing replaced by LNS, called with iteration budgets), the stage name check (`lns` instead of `anneal`), and five self-test steps that were tied to the old card and goal-card markup.

## Decisions where the brief was silent

All listed in `docs/v4-notes.md`. The main ones: legacy rule switches are kept; `vol.exact` and `vol.quota` default to Must weight 3; `p.spread` is scored with default weight 2; volume rules are scored only on plans that carry `plan.targets`; a flow result that breaks a non-linear hard day rule is discarded in favour of the greedy placement; LNS never changes the number of visits or seats; `goal.strict` is no longer stored (a non-enumerable accessor keeps old code working); the default rest pattern and spread chips in the Rules tab set the level for every person.

## Known limitations

See the README. In short: delta evaluation re-evaluates the whole plan (exact but not key-partitioned); window re-layout through the flow and a day-wide Hungarian pass are not separate LNS neighbourhoods (the Hungarian solver is used as a two-visit re-staff move); no flow lower bound is computed (`lowerBound` is `null`, `optimal` is `false`); `js/solver.js` remains for the pre-check and the seat-level repair search; the flow handles one "at least one visit" rule per weekday; the polish is iteration-bound (40, 150 and 500 iterations on week, month, quarter) so the plan quality is limited by those caps; the People table and Goals manager were checked in jsdom, not in a real browser, because Chromium could not be downloaded in the build sandbox.
