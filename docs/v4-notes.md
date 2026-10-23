# v4 working notes (feeds the final report)

## Tests whose expectation changed

| Test | Change | Reason |
|---|---|---|
| L7 backup week: witness plan is valid under the project validator | soft violations from the new `cPrefs` group are allowed; any other soft violation still fails | fair.load is now a scored Prefer rule, so a hand-made witness plan can carry a fairness deviation |

## Decisions where the brief was silent

- `goal.strict` is no longer stored. `newGoal` defines `strict` as a non-enumerable accessor over `lv`, so older code and tests that assign `strict` still work; `goalMust(g)` reads `lv`.
- A saved, unapproved plan whose `gen.rulesRev` is below 8 loads with `stale = true`. Approved plans are left untouched.
- Rules that already had an on/off switch keep it (`rotation.on`, `seniority.on`, pairs, gender rules, patterns); the level applies when the rule is on.
- Volume rules (`vol.exact`, `vol.share`, `vol.quota`, `fac.pinned`) are scored only when the plan carries `plan.targets`, so hand-made plans are not penalised for targets they never had.
- `p.rest` for inherited default patterns takes its level from the person's `lv.rest`, seeded from the old default pattern strictness.

## Known limitations (phase 2)

- `deltaMove` re-evaluates the whole plan with `validatePlan` after each move and keeps the previous result for a free revert. It is exact (the 1,000-move test compares every step with a fresh evaluation) but it is not yet key-partitioned, so its cost grows with plan size. Key-partitioned re-scoring is the open item from section 3.3.
- Rule levels that exist only as stored data (no violation can be produced from a plan alone) are covered by the registry test, not by a flip scenario: `vol.quota`, `fac.pinned`, `dist.short`, `dist.balanceFar`, `fair.load`, `goal.cover`, `goal.maxGap`, `goal.together`, `goal.special`, `goal.pattern`, `p.spread`, `skill.match`, `space.shape`, `due.priority`.

## Phase 3 decisions

- Layout is solved by `js/layout.js` (min-cost flow over `js/flow.js`): mandatory units plus candidate facilities per kind, kind quotas as capacity, Prefer-goal facilities as rewards. Hard day rules that are not linear (gap spacing, activity patterns) are checked after the flow; when any flow placement fails them the flow result is discarded and the original greedy placement runs, which keeps every earlier guarantee. The flow solver uses a big-M cost on lower-bound edges instead of the transformed circulation, and reports `lowerBoundsMet()`.
- Staffing construction still uses `assignTeam` day by day and `searchPlan`/`solveTeams` in `js/solver.js` for exact repair; `js/solver.js` is therefore not deleted (it also holds `preflightPlan`). `js/anneal.js` is deleted and replaced by `js/lns.js`.
- `js/lns.js`: seeded Late Acceptance Hill Climbing (history 50) over the unified score with moves N4 day, N4 swap days, N4 facility, N3 person, N3 swap, N3 chain (ejection), N3 restaff, kick restarts, up to 3 restarts when hard > 0. Window re-layout through the flow (N1) and Hungarian re-staffing (N3 as written in the brief) are not implemented; `hungarian` exists and is cross-checked against the flow solver but the pipeline does not call it.
- Seats are not dropped and visits are not added or removed by LNS: with equal weights that would let it trade a visit for an open seat, which the product never did.
- `vol.exact` and `vol.quota` default to Must weight 3 so that a Must "at most" goal outranks a count shortfall (test B1) while still outranking Prefer rules.
- `plan.targets` is recorded by `generatePlan` so volume rules and pinned facilities are scored on generated plans; `plan.gen.search` carries stage, iterations, per-move stats, score and seed. `lowerBound` is `null` and `optimal` is `false`: no flow relaxation bound is computed.
- Budgets: LNS iteration caps are 3,000 / 8,000 / 15,000 for week / month / quarter windows with wall-clock caps of 400 ms / 1.5 s / 5 s (polish uses 80% of the cap, minus construction time, and is skipped when the soft score is already 0).
- Preflight proofs added: day-kind Must versus exact counts, exact count above the number of facilities, and "at least one" day rules with no possible visit; conflicts carry `rules` naming the rules involved.
- The reference solver (`Ref.best`) enumerates partial teams and scores with the production objective; T6 counts a generator result as optimal when it is at least as good as the best reference plan.

## Phase 4 decisions

- Every legacy Must/Try, rigid/flexible and light/medium/strong control is replaced by `LevelChip`. Engine and solver code that used those fields now reads `lv` through `pairRigid`, `pairStrength`, `genderPrefStrength`, `seniorRequired`, `rotationFactor`, `rotateMustActive` and `rotatePreferActive`.
- Rotation and repeat-block are one rule: the rotation switch also sets `repeatBlock.on`; the number of allowed repeats stays in `repeatBlock.times` and is shown when the rule is Must.
- The default rest pattern chip in the Rules tab and the people-spread chip set the level for every person; each person can still differ in the person editor.
- `p.spread` is now scored (1 unit per pair of consecutive calendar days a person works) with default weight 2 so it never outweighs a day rule at the default weight.
- The weekday favoured-category control is a multi-select popover (`patchDay` accepts an array).
- Day rule chips for kind, distance and category carry an "every visit / at least one visit" switch in their popover.
- T4 uses weight 8 for the Prefer variant: at weight 5 the optimiser may legitimately trade one unmet day category for a larger fairness and due-priority gain.
- Polish results are compared with the unified objective (soft score minus due reward), not with the raw soft score.

## Phases 5 and 6 changes to existing tests

| Test | Change | Reason |
|---|---|---|
| team: card tag | now checks that the People table shows a highlighted per-plan chip (`td.pt-c-quota .chip.on`) instead of the old card tag text | the card grid is replaced by the editable table; the per-plan summary is the chip |

| rules tab: goals section has people group | counts `.gm-row.people` instead of `.goal-card.people` | the goals section is now the master-detail manager |
| rules tab: add-goal menu grouped | finds the Add goal button in `.gm-toolbar` | same menu, new toolbar |
| add each goal type via menu | same selector change | same |
| delete new goals | counts `.gm-row` | row markup of the manager |

## Ship-readiness notes

- Two tests ("pattern goal editor renders and edits without NaN" and "Goals manager works in the Rules tab, the wide sheet and from the person Rules popover") failed at a 390 px window. Cause: the Goals manager shows master-detail only when the window is at least 980 px wide; narrower windows open a goal in a sheet from a zero-delay timer. Both tests assert the wide layout synchronously, so they were testing the window size as much as the feature. They now pin the wide layout with `App.ui.gmForceWide = true` (removed again in their cleanup), and a new async test, `ship: P4.5`, covers the narrow sheet flow. No expectation was relaxed.
- `el()` accepts `html:` only for static `<svg>` strings; other strings become text.
- Generation wall-clock caps are now four times wider than the iteration caps imply (`timeScale`, default 4), so iteration counts decide the result on any device up to roughly a 4x slowdown. A run that still hits the clock sets `plan.gen.search.truncated`.
- Touch targets: buttons, tabs, icon buttons, selects and text inputs are 40 px on coarse pointers. Still below 40 px on touch: checkboxes (22 px), toggle switches (38x22), calendar add buttons (28 px) and a few dense table controls.
- The Rules tab now opens in Simple mode (key rules, no weights). The test "toggling every rule chip between Must and Prefer regenerates without errors" drives every chip and slider, so it now selects Advanced mode first and restores the previous mode afterwards. No expectation changed.
