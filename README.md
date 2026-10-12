# الخطة · al-Khitta 3.0

A rebuilt planner for inspection visits. It picks which facilities are due, spreads them across workdays, and assigns balanced teams. The rules can be tuned, but the defaults work as-is: open the app and press **Generate**.

## Structure
```
index.html            shell (loads scripts in order)
css/app.css           design system (tokens, light/dark, RTL, responsive, print)
js/core.js            dates (ordinal-day math), parsing, DOM helper, icons
js/seed.js            seed facilities, locations, categories, people, pools
js/store.js           data model, v4→v5 migration, persistence, domain helpers
js/i18n.js            Arabic / English strings
js/people-rules.js    compiles person goals, pair goals and per-plan quotas into one rule index (deny / count / together)
js/engine.js          capacity, scoring, team assignment (with preset people), gender repair, analysis, approve/undo
js/goals.js           goal & fixed-visit models, demand builder, fixed-visit conflict checks
js/constraints.js     the one validator (validatePlan), goal evaluation, work/rest rules, history lookback, generation snapshots
js/solver.js          feasibility pre-check (proven conflicts), seat-level search, layout moves; bounded and deterministic
js/planner.js         generation pipeline: window → fixed visits → goal demand → selection → placement → teams → repair → search
js/ui.js              popover stack, menus, sheet, dialog, toast, controls (Seg/Switch/Stepper/Slider/DaySet/MiniCal…)
js/io.js              XLSX writer/reader, CSV, import preview/apply, plan export, matrix sheet
js/views/plan.js      setup strip + List / Calendar / Matrix / Summary views, visit sheet, action bar
js/views/facilities.js  table, bulk actions, facility sheet, categories, locations
js/views/team.js      people cards, person sheet, groups & seats
js/views/goals.js     goals editor (sheet + rules section), fixed-visit sheet, plan-strip popovers, progress block
js/views/rules.js     all rules with a sticky section nav (scroll-spy) and on/off status per section
js/views/data.js      import, unresolved names, backup/restore, appearance, reset
test.html             dev test runner: isolated storage, app self-test, regression suite (not needed in production)
js/selftest.js        full-app UI and flow checks (generation, views, sheets, rules, export, approve, English mode)
js/tests/             env.js (storage isolation), kit.js, fixtures.js (deterministic fixtures), reference.js (exhaustive solver), regress.js (regression cases)
```

## Goals (v3.1)
A list of goals, each switchable and marked **Must** (served first) or **Try** (served if there is room). Every goal has a scope: all, type, categories, locations, or specific facilities.
- **Cover**: visit every facility in scope N times, counted from a date. Optional *finish by* deadline: if it falls inside the plan, visits are placed before it; if it is later, the work is paced evenly up to it. *Start over* begins a new round once complete (moved forward on approve).
- **At least N** per plan for the scope.
- **At most N** per plan for the scope (hard cap on selection).
- **Max gap**: no facility in scope goes more than X days unvisited; due visits get a deadline.
The default is one goal: *Cover all facilities ×1, no deadline, Try*. This makes rotation coverage-aware without changing how many visits a plan has.

The engine merges all goals into a demand list (per facility: count, priority tier, deadline). Must goals come first, smaller goals before bigger ones, and the total is capped by the period's capacity. Leftover room is filled by the normal volume settings, which prefer facilities the goals still need. The Summary view shows progress for each goal. An unmet Must goal is a hard violation and blocks approval; an unmet Try goal is only reported.

## People goals (v3.2)
Goals come in two groups. **Facility goals** are listed above. **People goals** are new:
- **Person rule**: one or more people, with a rule and a scope. *Never* (e.g. never goes to contracted), *Only* (only goes to this scope), or *Exactly / At least / At most N* visits in this plan, counted inside the scope.
- **Pair together**: two people should go out together in at least (or at most) X% of their visits, e.g. half the places. Optional scope. The % is taken from the visits of whichever of the two goes out less. *At most 0%* means they never meet.
- **Special visit**: a chosen facility, N times, within a flexible date window. You can pick people (who are then held for that day) and fill the remaining seats automatically; with no people the team is always filled automatically. A visit only counts when it is at that facility inside the window with all the chosen people.
- **Work/rest pattern**: chosen people, a minimum rest between workdays, a limit on consecutive days, or a work/rest cycle, optionally inside a date window.

**Visits per plan (per person)**: in the person sheet you choose *Auto* (by share), *Exact N*, or a *Range min–max*. This replaces the old "fixed count". Saved data is migrated (`fixed:N` → `quota:{min:N,max:N}`).

### How it works
`compilePeopleRules()` turns all of these into one index that the engine uses:
- **deny**: (person, scope) pairs. *Must* = hard filter in `hardOk`, *Try* = a soft penalty.
- **counts**: per-person counters, each with an optional scope, a min and a max. *Must* max = hard cap; min pulls the person in, scaled by how far below it they are.
- **together**: pair counters. Picking a person whose partner is already on the team gets a boost (or a penalty for *at most*).

The planning context uses one tally helper (`ctxTally` / `ctxPairTally`) for every change, including the gender repair swaps, so the counters never go out of sync. Consecutive-day limits are checked on the real set of dates, not on placement order. After teams are assigned, `repairPeopleRules` swaps seats one by one when that lowers the total violation score, and never breaks hard rules, gender rules or rigid pairs. `analyzePlan` adds a **People rules** check and a note for each break. Seat swaps in the visit sheet flag candidates that would break a rule or a quota.

## Fixed visits (overrides)
For example: *2026-10-03, this facility, these people*. Each fixed visit:
- is placed first and counts toward the day cap, the weekly cap and the goals;
- holds its people that day, so they get no other visit;
- counts toward fairness (load);
- turns a non-workday into a one-off workday for that visit only;
- can use exactly the people you picked, or fill the remaining seats automatically. With no people it uses an auto team.

You can add one from the **Fixed visits** tile, the **+** on any calendar day, the Rules tab, or **Fix this visit** in a visit's sheet. Fixed visits keep their date and team on regenerate. Editing a fixed visit in the plan updates the override. The sheet lists conflicts: person off, blocked, booked twice, excluded facility.

## Defaults
Workdays are Sunday to Thursday (5 days). Visit mix is 3 basic : 2 contracted (basic share 60%). Existing saved data is moved to these defaults once (settings rev 6).

## Features
- **Plan tab**: six summary tiles (Period, Workdays, Visits, Team, Goals, Fixed visits). Each opens an in-place popover, so the page never expands, collapses or jumps. Generate/Regenerate button. Stale-plan banner.
- **Views**: List (grouped by day), Calendar (month grid; drag a visit to another day), Matrix (people × days or facilities × days, with unavailable days shaded), Summary (KPIs, workload vs expected, checks, notes, carry-over).
- **Visit sheet**: why this facility was picked, issues, swapping or filling a seat (shows why someone is ineligible), moving to another date (shows conflicts), replacing the facility, removing the visit, history.
- **Per-person availability**: follows the plan's days, fixed weekdays, or a work/rest cycle (e.g. 2 on / 2 off from an anchor date). Also: max consecutive days, max visits per week, days off (click or Shift-range), blocked facilities, distance preference, starting point, fixed count or percentage share.
- **Skill**: 0–100 per visit type, with optional per-category overrides. Replaces the old 1–5 rank.
- **Importance**: 0–100 per facility, with a configurable seniority threshold (require or prefer) and matching strength.
- **Gender rules**: an ordered list, each rule switchable on/off. Scope by type, categories or specific facilities. Set a minimum % of each gender and whether to avoid even splits (e.g. 2+2). The rule card previews which team splits are valid.
- **Preferences by gender** (inside Gender rules): separate soft preferences for men and women: near/far trips, basic/contracted facilities, preferred weekdays, and a strength (light/medium/strong). They weight who gets picked but never block anyone. Stored in `settings.genderPrefs.{m,f}`.
- **Dropdowns**: every select is a themed button with a popover menu (searchable when it has more than 8 options), so it matches the other controls and the dark theme.
- **Pairs**: together/apart, flexible (light/medium/strong) or rigid, each switchable on/off.
- **Distance**: editable near/far km bands, trips measured from HQ or each person's starting point, a short-trip preference, sharing far trips evenly, and a facility pick bias.
- **Per weekday**: max visits, min visits, type lean, distance lean, favoured category, only-these categories.
- **Volume**: fill days (basic share), exact counts, or per-category quotas. Per-day and per-week caps. Spacing: even, packed, or with a minimum gap.
- **Coverage goal**: cover a scope N times; the end date is computed automatically.
- **Approve**: writes visit history and fairness counts. Can be undone.
- **Export**: XLSX (plan sheet + team-matrix sheet), CSV, copy as TSV, print. Choose full / without team / without facility names.
- **Import**: visit history, facilities or team from XLSX/CSV/paste, with a preview and undo. Unknown names are queued for linking. JSON backup and restore (also accepts v4 backups).

## Data
Everything is stored in `localStorage` (`alkhitta.v5`, `alkhitta.plan.v5`). Existing `alkhitta.v4` data is migrated automatically on first load. No backend.

## One validator
`validatePlan(plan, {source})` in `js/constraints.js` is the only place that decides whether a plan is valid. Generation, repairs, the search, manual edits, approval, the summary and goal progress all call it (or the transactional tallies that are tested to equal it). Every finding is one record: class, group, people, facilities, dates, visits, actual vs required, message key.

| Class | Meaning | Effect |
|---|---|---|
| hard | a Must rule or a structural rule is broken | the plan is invalid; approval is blocked |
| soft | a Try rule or preference is not met | reported only |
| exception | a fixed visit's locked people break a rule | recorded and shown; does not block |

Goal rows report `met`, `short`, `progress`, `exceeded` or `new`. A Try maximum that is passed shows as *Exceeded*, never as a failure. Progress for a stale plan shows the generation-time results and the current-settings results separately.

## Work/rest patterns
A pattern is a minimum rest (days between workdays), a maximum run of consecutive days, and an optional on/off cycle with an anchor date.
- **Plan activity pattern** (Rules → Work and rest): applies to days on which the plan has any visit, regardless of who goes. Must or Try.
- **Default person rule** (same section): applies to each person. Must or Try.
- **Person rule** (person sheet): *Team default*, *Custom* (minimum rest, plus the person's own max run) or *No limits*, which overrides the global rule for that person.
- **Pattern goal** (Goals): chosen people, optional window. Must or Try.
- *Spacing between active plan days* (Visit volume) is the soft/hard version of a plan-level gap.
Precedence: a person's own limits and pattern goals always apply; the default person rule applies only when the person is on *Team default*; *No limits* switches the default off for that person. History from the 30 days before the plan counts, so a rest rule holds across the plan boundary.

**Require a visit on every eligible plan day** (Visit volume, off by default): when on, every eligible workday needs a fully staffed, valid visit. The summary shows eligible, covered and uncovered days.

## Generation result
`generatePlan()` returns a plan plus a status:
- `valid`: no hard violation.
- `infeasible`: a necessary condition fails, with named conflicts (a person's minimum above what their days allow, mandatory visits above the exact volume, a cap below a minimum, a rigid pair with no shared seats or days, an every-day requirement the volume, caps or rest rules cannot meet, and so on). Only proven conflicts use this word.
- `exhausted`: no conflict was proven, but the bounded search did not find a valid plan. Feasibility is unknown.
- `invalid`: a draft was returned without searching, or a manual edit broke a rule.
The draft is always shown with its violations. The search is deterministic for a given input (fixed seed, node budget) with a wall-clock cap of 1.5 s (300 ms when infeasibility is already proven).

## Manual edits
Swap, fill, move, replace and remove all go through `mutatePlan`, which evaluates the edit on a copy with the validator. If the edit introduces a hard violation the dialog names it and asks before applying. Candidate menus show the same verdicts. Approval re-validates and is refused for stale or hard-invalid plans; there is no override.

## Migration
Saved data without `rulesRev` (or older than 7) is migrated on load without removing people, facilities, goals or history. It adds `settings.patterns`, `volume.requireEveryEligibleDay` (false), `spacing.strict`, and per-person `pattern` (`inherit`); malformed numbers and dates are sanitised. `alkhitta.v4` and v4 backups still import.

## Tests
- Open `test.html`. It replaces `localStorage` with an in-memory shim first and refuses to run if it cannot, so the real data is never cleared. It runs the app self-test and then the regression suite; the last line is `RESULT pass=… fail=…`.
- `js/tests/regress.js` holds the regression cases: audit findings A–E (plan spacing, max-gap deadlines and chains, caps and At most, exact and range person counts, special visits, hard/soft separation, snapshots), work/rest patterns, require-every-day, infeasible vs exhausted, deterministic output, edit and approval integrity, migration, and a seeded fuzz that compares the generator with an exhaustive reference. Each case returns `true` or a `verdict(...)`; a bare string counts as a failure.
- The old seed-data self-test alone is not evidence of readiness.

## Performance limits
Seed data (about 150 facilities, 11 people): week, month and quarter plans validate with zero hard violations in under about 100 ms. The search stops at 120,000 nodes or 1.5 s, whichever is first; exhaustive reference checks are for small fixtures only (a handful of days and people).

## Release checklist
1. `test.html` shows `fail=0` and no uncaught errors.
2. Generate week, month and quarter plans from a fresh seed: zero hard violations, summary quantities match the plan.
3. Break a Must rule in the visit sheet: the dialog names it; approval is refused until fixed.
4. Rules → Work and rest and the person sheet: toggle patterns, Must/Try, require-every-day; regenerate; summary shows the result.
5. Check Arabic and English, light and dark, and 390 px width (no horizontal scroll).
6. Export XLSX/CSV and print preview.
7. Load an older backup: nothing is lost, rules revision is current.
8. No code comments in JS, CSS or HTML.

## Known limitations
- The search is bounded; `exhausted` is not a proof of infeasibility.
- Facility replacement moves in the search keep the visit kind; unusual per-category seat overrides disable the seat-count conflict check rather than risk a wrong claim.
- History before the lookback window (30 days) is not used by rest rules.
- Patterns are evaluated per plan; there is no cross-plan fairness for them.

## Deploy
This is a static site with no build step. On Vercel, serve the repo root. You can drop `test.html`.

## Possible next steps
- People goals measured across several plans (e.g. "at most 2 far trips a month").
- Goal templates (e.g. "all hospitals monthly"); recurring fixed visits (every first Sunday).
- Undo history for manual plan edits; comparing several plans side by side.
