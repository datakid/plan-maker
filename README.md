# الخطة · al-Khitta 4.0

A rebuilt planner for inspection visits. It picks which facilities are due, spreads them across workdays, and assigns balanced teams. The rules can be tuned, but the defaults work as-is: open the app and press **Generate**.

## Motion polish
The motion layer sits at the end of `css/app.css`, with small hooks in `js/app.js` (`moveTabInd`, `syncTabs`, `pageEnter`), `js/ui.js` (toast exit) and `js/views/plan.js` (`view-enter` when switching views). It adds a sliding tab indicator, staggered page entry, spring easing on sheets, popovers, dialogs and toasts, press feedback on controls, and a sheen on the Generate button while it is busy. Switching tabs updates the tab bar in place instead of rebuilding it. All motion turns off under `prefers-reduced-motion`. The engine files were not changed.

## Structure
```
index.html            shell (loads scripts in order)
css/app.css           design system (tokens, light/dark, RTL, responsive, print) plus the v4 blocks at the end
js/core.js            dates (ordinal-day math), parsing, DOM helper, icons
js/seed.js            seed facilities, locations, categories, people, pools
js/store.js           data model, migrations, persistence, domain helpers
js/i18n.js            Arabic / English strings, including the rule registry texts
js/rules-model.js     rule registry (levels, weights, units), level helpers, RULES_REV 9 migration, weekday rule helpers
js/people-rules.js    compiles person goals, pair goals and per-plan quotas into one rule index (deny / count / together)
js/engine.js          capacity, scoring, team assignment (with preset people), gender repair, analysis, approve/undo
js/goals.js           goal & fixed-visit models, demand builder, fixed-visit conflict checks
js/requests.js       compiles fixed visits and specials into one request list (seats resolved once), applies the duplicate policy (ask / merge / keep / reject)
js/constraints.js     validatePlan: the one validator, a thin layer that tags every violation with rule, level, weight and units; goal evaluation, work/rest rules, history lookback, generation snapshots
js/score.js           preference scoring (weekday rules, volume targets, distance, gender preferences, rotation, spread, fairness), plan state, due-ness reward, move apply / delta / revert
js/flow.js            min-cost flow (successive shortest paths, Johnson potentials, binary-heap Dijkstra, big-M lower bounds)
js/assign.js          Hungarian algorithm (rectangular, integer or real costs)
js/layout.js          builds the layout network (candidates, days, weeks) and reads the placement back
js/solver.js          feasibility pre-check (proven conflicts), seat-level search, layout moves; bounded and deterministic
js/lns.js             seeded Late Acceptance Hill Climbing with destroy-and-repair moves, kicks, restarts and a steepest-descent polish
js/explain.js         one probe per unmet item: the best single move that fixes it and the rules it would break
js/planner.js         generation pipeline: window → fixed visits → goal demand → selection → flow layout → teams → repair → search → LNS polish → explanations
js/ui.js              popover stack, menus, sheet, dialog, toast, controls (Seg/Switch/Stepper/Slider/DaySet/MiniCal/LevelChip…)
js/io.js              XLSX writer/reader, CSV, import preview/apply, plan export, matrix sheet
js/views/plan.js      setup strip + List / Calendar / Matrix / Summary views, visit sheet, rule contributions, action bar
js/views/facilities.js  table, bulk actions, facility sheet, categories, locations
js/views/team.js      person editor parts (sheet and panel), groups & seats
js/views/team-table.js  editable People table, docked detail panel, bulk bar
js/views/goals.js     fixed-visit sheet, plan-strip popovers, progress block, wide goals sheet
js/views/goals-manager.js  master-detail goals manager (Rules tab, wide sheet, person popover deep link)
js/views/rules.js     all rules with a sticky section nav (scroll-spy), level chips and on/off status per section
js/views/data.js      import, unresolved names, backup/restore, appearance, reset
test.html             dev test runner: isolated storage, app self-test, regression suite (not needed in production)
js/selftest.js        full-app UI and flow checks (generation, views, sheets, rules, export, approve, English mode)
js/tests/             panel.js, env.js, kit.js, fixtures.js, reference.js (exhaustive solver with the production objective), regress.js, phase1.js to phase10.js (phase10 is v5)
docs/                 v4-baseline.md (numbers before the v4 rewrite), v4-notes.md, v5-notes.md (v5 decisions, deviations, changed tests, what is not done)
```

## Goals (v3.1)
A list of goals, each switchable and marked **Must** (served first) or **Try** (served if there is room). Every goal has a scope: all, type, categories, locations, or specific facilities.
- **Cover**: visit every facility in scope N times, counted from a date. Optional *finish by* deadline: if it falls inside the plan, visits are placed before it; if it is later, the work is paced evenly up to it. *Start over* begins a new round once complete (moved forward on approve).
- **At least N** per plan for the scope.
- **At most N** per plan for the scope (hard cap on selection).
- **Max gap**: no facility in scope goes more than X days unvisited; due visits get a deadline.
The default is one goal: *Cover all facilities ×1, no deadline, Try*. This makes rotation coverage-aware without changing how many visits a plan has.

The engine merges all goals into a demand list (per facility: count, priority tier, deadline). Must goals come first, smaller goals before bigger ones, and the total is capped by the period's capacity. Leftover room is filled by the normal volume settings, which prefer facilities the goals still need. The Summary view shows progress for each goal. An unmet Must goal is a hard violation and blocks approval; an unmet Try goal is only reported.

## People editor
The People table uses a non-modal drawer docked to the viewport's inline-end edge (left in Arabic, right in English), below the topbar. At 1280 px and wider the table reserves room for the drawer; at 980–1279 px it overlays without a scrim. Below 980 px the editor remains a modal sheet with previous/next navigation. The drawer header stays pinned while its body scrolls. Escape closes the drawer and returns focus to its opening row; clicking the same row toggles it.

Availability and days-off popovers update in place, including weekday/cycle controls and the clear action. Panel edits repaint the complete table row; an open row popover keeps its anchor until closing. The table scrolls internally with sticky headers and selection/name columns.

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

## What changed in 4.0
Every rule that is not structural now has a **level**: *Must* or *Prefer*, with a weight from 1 to 10. One objective is used everywhere:

- `hardScore` = sum of weight x units over Must rules and structural rules (structural rules weigh 10);
- `softScore` = sum of weight x units over Prefer rules, minus the due-ness reward (overdue facilities, default weight 3);
- a plan is valid when `hardScore` is 0; plans compare lexicographically on (hard, soft).

`validatePlan` tags each violation with `rule`, `level`, `weight` and `units`, and returns `hardScore` and `softScore` next to the old counts. The generator, the LNS and the explanations all use this same function, so the solver's score is the validator's score.

Structural rules (always hard, shown with an "Always" tag): the calendar, days off, retired or inactive people, one place per person per day, the same facility once per day, seats from the right pool with none left open, the global per-day capacity, and a fixed visit's date and facility.

Prefer-only rules (Must is disabled): overdue priority, skill match, spacing shape, people spread over consecutive days.

### Rule registry
| Rule id | Name | Layer | Applies to | Default | Counts as one unit |
|---|---|---|---|---|---|
| `day.cap` | Weekday max visits | layout | day | Must 5 | 1 visit over |
| `day.min` | Weekday min visits | layout | day | Prefer 5 | 1 visit short |
| `day.kind` | Weekday kind lean | layout | day | Prefer 5 | 1 visit of the other kind |
| `day.band` | Weekday distance lean | layout | day | Prefer 5 | 1 visit in the other band |
| `day.category` | Weekday favoured categories | layout | day | Prefer 5 | 1 visit outside the categories |
| `day.only` | Weekday allowed categories | layout | day | Must 5 | 1 visit outside |
| `fac.weekdays` | Facility weekdays | layout | facility | Must 5 | 1 visit on another weekday |
| `vol.week` | Max visits per week | layout | global | Must 5 | 1 visit over |
| `vol.everyDay` | A visit every eligible day | layout | global | Must 5 | 1 empty day |
| `vol.exact` | Exact basic/contracted counts | layout | global | Must 3 | 1 visit off target |
| `vol.share` | Basic share | layout | global | Prefer 5 | 1 visit off the share |
| `vol.quota` | Category quotas | layout | global | Must 3 | 1 visit short or over |
| `vol.gap` | Gap between active days | layout | global | Prefer 5 | 1 pair too close |
| `vol.activity` | Plan activity pattern | layout | global | Must 5 | 1 breach |
| `fac.pinned` | Pinned facility | layout | facility | Prefer 9 | 1 pinned facility missing |
| `dist.pick` | Pick facilities by distance | layout | global | Prefer 5 | 1 visit in the opposite band |
| `p.blocked` | Person blocked facilities | staff | person | Must 5 | 1 assignment |
| `p.avail` | Person availability | staff | person | Must 5 | 1 assignment on an off day |
| `p.maxRun` | Person max run | staff | person | Must 5 | 1 breach |
| `p.maxWeek` | Person max per week | staff | person | Must 5 | 1 breach |
| `p.rest` | Person rest pattern | staff | person | Must 5 | 1 breach |
| `p.quota` | Person visits per plan | both | person | Must 5 | 1 visit outside the range |
| `p.dist` | Person distance preference | staff | person | Prefer 5 | 1 assignment in the opposite band |
| `fair.load` | Fairness by share | staff | global | Prefer 5 | Σ max(0, |load − expected| − 0.5) |
| `gender.rule` | Team gender rule | staff | item | Prefer 8 | 1 invalid team |
| `gender.pref.m` | Male preference | staff | global | Prefer 5 | 1 mismatch per dimension |
| `gender.pref.f` | Female preference | staff | global | Prefer 5 | 1 mismatch per dimension |
| `senior` | Seniority | staff | global | Must 5 | 1 team with no qualified member |
| `pair` | Pair rule | staff | item | Prefer 5 | 1 visit breaking it |
| `rotate` | People rotation | staff | global | Prefer 5 | Prefer: prior visits to the facility; Must: each assignment over N |
| `dist.short` | Short trips | staff | global | Prefer 5 | 1 far-band trip |
| `dist.balanceFar` | Balance far trips | staff | global | Prefer 5 | Σ max(0, far − minFar − 1) |
| `goal.cover` | Cover goal | layout | goal | Prefer 5 | 1 missing visit |
| `goal.atLeast` | At-least goal | layout | goal | Prefer 5 | 1 missing visit |
| `goal.atMost` | At-most goal | layout | goal | Must 5 | 1 extra visit |
| `goal.maxGap` | Max-gap goal | layout | goal | Must 5 | 1 late facility |
| `goal.person` | Person goal | staff | goal | Must 5 | 1 offending visit |
| `goal.together` | Together goal | staff | goal | Prefer 5 | Visits below the % target |
| `goal.special` | Special visit | both | goal | Must 5 | 1 missing visit |
| `goal.pattern` | Person pattern goal | both | goal | Must 5 | 1 breach |
| `due.priority` | Overdue priority | layout | global | Prefer only, Prefer 3 | Reward by overdue percentile |
| `skill.match` | Skill match | staff | global | Prefer only, Prefer 5 | Skill gap |
| `space.shape` | Spacing shape | layout | global | Prefer only, Prefer 5 | Deviation from the shape |
| `p.spread` | Consecutive-day spread | staff | person | Prefer only, Prefer 2 | Consecutive days |

Stored shape: `settings.lv[ruleId]`, `settings.days[wd].<field>.lv`, `person.lv`, `facility.lv`, `goal.lv`, `pair.lv`, `genderRule.lv`, each `{level, w}`. `RULES_REV` is 8; older data is migrated on load and a saved unapproved plan from an older revision loads as stale. Rules that already had an on/off switch keep it (rotation, seniority, pairs, gender rules, patterns).

### Solver
1. **Compile and prove.** The window, fixed visits and goal demand are built as before. The pre-check proves conflicts against the Must rules (including day-kind rules against exact counts, exact counts above the facilities that exist, and "at least one" day rules with no possible visit) and returns `infeasible` with the rules named.
2. **Layout by min-cost flow.** Mandatory units plus candidate facilities per kind flow through kind -> facility copy -> day -> week. Day caps, minimums, "all / at least one" lean rules, weekday and category limits, deadlines, spacing shape, due reward and goal rewards are edge costs, capacities or lower bounds. Selection and placement are solved together. If any flow placement breaks a non-linear hard day rule (gap spacing, activity patterns) the flow result is discarded and the greedy placement runs.
3. **One placement path.** `compileRequests` turns fixed visits and specials into requests with seats resolved once; `generatePlan` places them through the same `canPlace` and seat ledger as every other unit. Flow placements that pass `canPlace` are kept and only the rest are re-queued (`layout.rolledBackUnits`); if that run is not valid it is repeated once in the old all-or-nothing mode and the better score wins (`layout.retriedAllOrNothing`).
   Teams are built day by day; a seat-level search repairs hard violations.
4. **LNS** (`js/lns.js`): seeded Late Acceptance Hill Climbing over the unified score with moves for day, swapped days, facility, person, swapped people, ejection chains, whole-visit re-staffing and Hungarian re-staffing, kicks and restarts when hard violations remain, then a steepest-descent polish. The count-changing moves `N5insert` and `N5remove` only run for exact counts set to Up to; `N5swapInsert` (remove one visit, add one of the same kind) always runs. `continueFrom` resumes a stored plan with a derived seed (Keep searching).
5. **Explanations** (`js/explain.js`): for each unmet Prefer item and each Must violation, the best single move that fixes it and the rules it would break are stored in `plan.why` and shown in the Summary and the visit sheet.

`plan.gen.search` records stage, iterations, per-move statistics, score, seed and the layout stage. Status is `valid`, `infeasible` (proof only) or `exhausted`.

The Summary also shows seat shortages per day and pool (`explainSeats`: need, who is free, who is off, in a rest cycle, at their limit or held by a fixed visit, with a one-click fix when a fixed visit or special can lower its seats) and The equation card (`buildModel`, `modelText`): the exact objective, every Must and Prefer term with level, weight, units and contribution, the due reward and the structural rules; it can be copied or exported as .txt and .json, and its totals equal the search score.

### Budgets
Iteration caps are primary and wall-clock caps are a safety cutoff. The polish uses at most `cap / 4` iterations (80, 300 and 1000 on week, month and quarter windows; it stops earlier once there are no hard violations and no improvement for max(400, 30 x visits) iterations; caps 400 ms, 1.5 s and 5 s, polish uses 80% of the cap minus construction time). Repair of hard violations uses 3,000 / 8,000 / 15,000 iterations. The same input and seed give the same plan as long as the iteration cap is reached before the wall-clock cap, which is the case for the seed data.

## What changed in 5.0
- **One pipeline.** Fixed visits, specials and ordinary units are placed through the same `canPlace` and seat ledger (`js/requests.js`); duplicate requests for one place follow a policy (Ask, Merge, Keep both, Reject newer) stored per request once answered.
- **Visits per day.** Up to or Exactly per day, Use all days as Off / Try / Must, and exact counts as Up to or Exactly. Defaults reproduce 4.x behaviour.
- **Seats.** One seat stepper that starts from the shown default, a Default button per pool, location-level default seats, and guests (outside people who take a seat and are never in the team).
- **Rules for one visit.** Gender and senior overrides on a fixed visit or special.
- **Search.** Partial acceptance of flow placements, insert / remove / swap-insert moves, a stop rule, deterministic continuation and a Keep searching button.
- **Explanations.** Seat shortages per day with reasons and fixes, and The equation card with copy and export.
- Decisions, deviations and what is not done are in `docs/v5-notes.md`.

## Rules and first run
The Rules tab opens in **Simple** mode: the key rules (goals, calendar, volume, gender, pairs) with Must or Prefer only, no weights. **Advanced** shows every rule and weight; the choice is remembered. The search box finds rules in either mode. A plan-less Plan tab shows a three step checklist (work days, team, generate), and facilities and team show an empty state. When a plan is infeasible or exhausted, solvable conflicts get a button that applies the fix and regenerates.

## Architecture: generation in a worker
`js/genrun.js` starts `js/worker.js`, which loads the engine files with `importScripts` and runs `generatePlan` on a JSON copy of `App.data`. The page stays responsive; the bar at the bottom shows the stage and percent, and *Cancel* terminates the worker. If workers are unavailable (or the script fails to load) the same code runs inline, which is also what `test.html` calls directly. Worker and inline runs give the same plan for the same seed: iteration counts decide the search, and the wall-clock caps are a safety net four times wider (`timeScale`, default 4). A run that still hits the clock sets `plan.gen.search.truncated`, and Summary says it stopped early on this device.

After a regenerate the previous plan is kept in memory: a chip shows `+added -removed moved m team changed n` with *Keep previous plan*. Manual edits can be undone and redone (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, and the toolbar buttons; 50 steps, cleared when the plan is replaced).

## Features
- **Plan tab**: six summary tiles (Period, Workdays, Visits, Team, Goals, Fixed visits). Each opens an in-place popover, so the page never expands, collapses or jumps. Generate/Regenerate button. Stale-plan banner.
- **Views**: List (grouped by day), Calendar (month grid; drag a visit to another day), Matrix (people × days or facilities × days, with unavailable days shaded), Summary (KPIs, workload vs expected, checks, notes, carry-over).
- **Visit sheet**: why this facility was picked, issues, swapping or filling a seat (shows why someone is ineligible), moving to another date (shows conflicts), replacing the facility, removing the visit, history.
- **Per-person availability**: follows the plan's days, fixed weekdays, or a work/rest cycle (e.g. 2 on / 2 off from an anchor date). Also: max consecutive days, max visits per week, days off (click or Shift-range), blocked facilities, distance preference, starting point, fixed count or percentage share.
- **Skill**: 0–100 per visit type, with optional per-category overrides. Replaces the old 1–5 rank.
- **Importance**: 0–100 per facility, with a configurable seniority threshold (require or prefer) and matching strength.
- **Gender rules**: an ordered list, each rule switchable on/off. Scope by type, categories or specific facilities. Set a minimum % of each gender and whether to avoid even splits (e.g. 2+2). The rule card previews which team splits are valid.
- **Preferences by gender** (inside Gender rules): separate preferences for men and women: near/far trips, basic/contracted facilities, preferred weekdays, each with a level chip. They weight who gets picked but never block anyone. Stored in `settings.genderPrefs.{m,f}`.
- **Dropdowns**: every select is a themed button with a popover menu (searchable when it has more than 8 options), so it matches the other controls and the dark theme.
- **Pairs**: together/apart, each with a level chip (Must is the old rigid, Prefer weights replace light/medium/strong), each switchable on/off.
- **Distance**: editable near/far km bands, trips measured from HQ or each person's starting point, a short-trip preference, sharing far trips evenly, and a facility pick bias.
- **Per weekday**: max visits, min visits, type lean, distance lean, favoured categories, only-these categories; each configured cell has a level chip, and lean cells can mean every visit that day or at least one.
- **Volume**: fill days (basic share), exact counts, or per-category quotas. Per-day and per-week caps. Spacing: even, packed, or with a minimum gap.
- **Coverage goal**: cover a scope N times; the end date is computed automatically.
- **Approve**: writes visit history and fairness counts. Can be undone.
- **Export**: XLSX (plan sheet + team-matrix sheet), CSV, copy as TSV, print. Choose full / without team / without facility names.
- **Import**: visit history, facilities or team from XLSX/CSV/paste, with a preview and undo. Unknown names are queued for linking. JSON backup and restore (also accepts v4 backups).

## Data
Everything is stored in `localStorage` (`alkhitta.v5`, `alkhitta.plan.v5`). Existing `alkhitta.v4` data is migrated automatically on first load. No backend.

### Storage safety
- **One writer.** When another window changes `alkhitta.v5` or `alkhitta.plan.v5`, this window becomes read-only: saving and the unload save stop, and a banner offers *Reload* or *Use this window's data*. Nothing is written until the user chooses.
- **Atomic saves.** Each save writes `<key>.tmp`, verifies it by reading it back and parsing it, then writes the main key and removes the tmp key. On load a leftover tmp value wins when the main value is broken or older, and a toast says so.
- **Full storage.** `QuotaExceededError` never writes partial data: the in-memory data stays, and a dialog offers a JSON backup download. The Data tab shows the storage used.
- **Snapshots.** The last 3 data snapshots (size capped at about 1.5 MB of text) are taken before *Approve*, before every import and before every restore, under `alkhitta.snap.v1`. The Data tab lists them with a *Restore* button.
- **Corrupt data.** Stored data is sanitized before `normalizeData`: wrong types, `null` entries, duplicate ids and bad numbers are dropped or repaired per record, so one bad record never costs the valid ones. An unreadable main value is kept under `alkhitta.corrupt.v1` instead of being overwritten by seed data.
- **Markup.** `el({html})` only accepts a static `<svg>` string; anything else is inserted as text, so names from imports or backups are never parsed as HTML.
- **Erase all data** stops writes first, so the unload save cannot bring the data back.
- Backups and XLSX exports carry the app version (`appVersion` in the JSON, the document description in the workbook).

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
- `infeasible`: a necessary condition fails, with named conflicts (a person's minimum above what their days allow, mandatory visits above the exact volume, a cap below a minimum, a rigid pair with no shared seats or days, an every-day requirement the volume, caps or rest rules cannot meet, and so on). Only proven conflicts use this word. Seat-count checks count as proofs when the volume is exact, or when nobody in a pool can work at all; otherwise they are shown as warnings.
- `exhausted`: no conflict was proven, but the bounded search did not find a valid plan. Feasibility is unknown.
- `invalid`: a draft was returned without searching, or a manual edit broke a rule.
The draft is always shown with its violations. The search is deterministic for a given input (fixed seed, node, evaluation and iteration caps); the wall-clock caps can only end a run earlier on a slow machine.

Stages (the first two run only when the previous one left a hard violation; the LNS polish and explanations run on valid plans too):
1. **Draft**: window, fixed visits, goal demand, selection, placement, teams, repairs. The number of visits is capped by what each day can really staff (a day with one available admin can still host a visit that needs one), not by a blended average.
2. **Search**: seat-level team search plus layout moves. Layout moves are sampled (biased to visits in current violations), scored by seat flow, scoped quotas, rigid-pair availability and gender feasibility, and restarted from the best layout with growing random kicks until the node, evaluation, loop or time cap is reached. Up to 1.5 s.
3. **LNS**: the seeded Late Acceptance search described under *Solver*; it also improves plans that are already valid.

## Manual edits
Swap, fill, move, replace and remove all go through `mutatePlan`, which evaluates the edit on a copy with the validator. If the edit introduces a hard violation the dialog names it and asks before applying. Candidate menus show the same verdicts. Approval re-validates and is refused for stale or hard-invalid plans; there is no override.

## Migration
Saved data without `rulesRev` (or older than 7) is migrated on load without removing people, facilities, goals or history. It adds `settings.patterns`, `volume.requireEveryEligibleDay` (false), `spacing.strict`, and per-person `pattern` (`inherit`); malformed numbers and dates are sanitised. `alkhitta.v4` and v4 backups still import.

Rev 9 (v5): saves from rev 8 load with `volume.dayMode` Up to, `volume.useAllDays` taken from the old every-day switch (true becomes Must, false Off), `volume.exactMode` Exactly, an empty guest list, `duplicates` Ask and no per-visit rules or location seats; behaviour is unchanged until you use them. A stored plan older than rev 9 loads as stale and needs regenerating.

## Tests
- `scripts/ci-run.js` (Playwright, run by `.github/workflows/test.yml`) serves the repo and runs: the app end to end (no CSP violations, worker used, self-hosted fonts, no external requests, service worker cache covers every asset, offline reload and offline generation), `docs/people-matrix.html`, and `test.html` at 1280 px. `ONLY=app|matrix|suite` runs one part; `CHROME_PATH` points at a local Chromium.
- `ship-test.html` runs only the `ship:` tests in `js/tests/phase8.js` (data safety, worker, solver internals, undo, diff, focus, diagnostics, versions). It is much faster than the full suite.
- Open `test.html`. It replaces `localStorage` with an in-memory shim first and refuses to run if it cannot, so the real data is never cleared. It runs the app self-test and then the regression suite. A results panel covers the page: green "ALL TESTS PASSED" with `RESULT pass=… fail=0`, or red with each failing test listed (tick the box to list passing ones too, or use "Show app" to see the page). The same lines are printed to the console.
- `js/tests/reference.js` has two exhaustive solvers for small fixtures: `Ref.solve` (facilities, then days, then teams) and `Ref.days` (day by day with pruning on availability, rest, quotas and weekly caps, then the validator as the oracle).
- `js/tests/phase1.js` to `phase7.js` hold the v4 tests: registry and migration, every rule flipped between Must and Prefer, delta against full evaluation, flow and Hungarian cross-checks, T1 to T9, LevelChip reachability, People table, Goals manager and explanations.
- `js/tests/phase10.js` holds the v5 tests: seat stepper, duplicate detection and policy, requests and the single placement path, flow partial acceptance, insert and remove moves, continuation, volume and use-all-days settings, guests, per-visit rules, seat shortages, the equation, and the rev 9 migration.
- `js/tests/regress.js` holds the regression cases (L1 to L15 cover the backup week of a real failing plan, gender, pair, quota, every-day and deadline fixtures, LNS repair and preflight proofs; K2 compares the generator with the reference across five fixture families and needs at least 99% valid; K3 checks determinism): audit findings A–E (plan spacing, max-gap deadlines and chains, caps and At most, exact and range person counts, special visits, hard/soft separation, snapshots), work/rest patterns, require-every-day, infeasible vs exhausted, deterministic output, edit and approval integrity, migration, and a seeded fuzz that compares the generator with an exhaustive reference. Each case returns `true` or a `verdict(...)`; a bare string counts as a failure.
- The old seed-data self-test alone is not evidence of readiness.
- `people-test.html` runs the four existing People cases plus five UI regressions and the uncaught-error check using isolated in-memory storage. Focused result: `RESULT pass=10 fail=0`.
- `docs/people-matrix.html` checks the actual app at 1440, 1280, 1100 and 390 px, Arabic/English, light/dark, first/last row: `MATRIX pass=32 fail=0`. This is automated geometry/interaction coverage, not a substitute for visual review of every combination.
- `people-preview.html` opens an isolated People editor for visual review; optional query parameters: `?lang=en&theme=dark`. `docs/ui-check.html` wraps the unchanged full suite at 1280 px.
- Full-suite results (Chromium 1280 px and 1440 px): original `5fa9c7f` `RESULT pass=235 fail=0`; this branch `RESULT pass=242 fail=0` (five People UI tests plus solver cases S1 and S2). Ship-readiness branch: `RESULT pass=272 fail=0` at both 1280 px and 390 px (served over http, so the worker is exercised). The two tests that failed at 390 px asserted the wide Goals manager layout synchronously; they now pin it and a new test covers the narrow sheet (see `docs/v4-notes.md`). Baseline numbers and generation timings are in `docs/baseline-ship.txt`.

## Performance
Seed data (about 150 facilities, 11 people), measured in headless jsdom on Node 22, full pipeline including LNS polish and explanations:

| Window | Visits | Time | Hard violations |
|---|---|---|---|
| Week | 5 | about 0.1-0.2 s | 0 |
| Month | 20 | about 0.5 s | 0 |
| Quarter | 70 | about 1.6 s | 0 |

Budgets: week under 400 ms, month under 1.5 s, quarter under 5 s (test T8).

## Release checklist
1. `test.html` shows `fail=0` and no uncaught errors. This includes T1 to T9: W1 Tuesday contracted in 20/20 seeds with the lean rule Prefer and Must (T1), two lean days (T2), Must contracted day against exact 5/0 counts is `infeasible` naming both rules (T3), favoured category like kind (T4), score equals `validatePlan` on 200 fixtures (T5), generator against the exhaustive reference (T6), same seed same plan (T7), seed-data budgets (T8), weight monotonicity (T9).
2. Generate week, month and quarter plans from a fresh seed: zero hard violations, summary quantities match the plan.
3. Break a Must rule in the visit sheet: the dialog names it; approval is refused until fixed.
4. Rules tab: open every section and flip a few level chips between Must and Prefer; regenerate; the Summary shows the rule contributions and the why lines.
5. People tab: edit a name, pool, skill, per-plan and max run inline; edit availability (weekdays and cycle) and days off (add and clear) through table popovers; keep the docked drawer open while moving between rows with the arrow keys; check Escape and row-toggle closure; bulk-edit two people and undo.
6. Goals: add each goal type, edit its number inline, filter by Failing, duplicate, delete and undo, in the Rules tab, in the wide sheet and from a person's Rules popover.
7. Check Arabic and English, light and dark, and 390 px width (no horizontal page scroll).
8. Export XLSX/CSV and print preview.
9. Load an older backup: nothing is lost, rules revision is 8.
10. No code comments in JS, CSS or HTML.

## Known limitations
- The search is bounded; `exhausted` is not a proof of infeasibility.
- Score re-evaluation after a move recomputes the whole plan (exact, checked against a fresh evaluation, but not key-partitioned). Moves now copy fields structurally, look up visits and busy people through indexes, and date/id lookups are cached, which made a quarter about twice as fast (about 1.9 s to 0.9 s at normal speed); a key-partitioned incremental score is still open.
- Window re-layout through the flow and a Hungarian pass over a whole day are not separate LNS neighbourhoods; layout comes from the initial flow and from day, swap and facility moves.
- The LNS adds or removes whole visits only when exact counts are set to Up to; it never adds or removes seats, and in all other modes the visit count is fixed by the volume setting.
- Touch targets are 40 px for buttons, tabs, inputs and selects; checkboxes (22 px), toggle switches (38x22) and calendar add buttons (28 px) are smaller.
- One-click conflict fixes cover exact counts, day rules, goals and the every-day requirement; other conflicts (for example a hard volume over capacity) still need a manual change. Plain-language wording of the explanations has not been reviewed by a native Arabic speaker.
- Two tabs writing at once is handled by making the older window read-only, not by merging.
- No flow relaxation bound is computed: `lowerBound` is `null` and `optimal` is `false`, so the Summary shows no gap.
- Guests are shown in the plan list and the team column of the export but not in the matrix or print views, and they do not count in gender-rule math.
- "Newer" in Reject newer means later in the list; requests carry no timestamp.
- Default-budget soft scores on a month or quarter vary slightly with machine load; with explicit iteration caps results are deterministic.
- The fixture exports used for acceptance (export_a.json, export_b.json) were not available when v5 was built.
- Layout flow covers at most one "at least one visit" rule per weekday; the others are left to LNS.
- Non-linear hard day rules (gap spacing, activity patterns) are not in the flow; when the flow breaks them the greedy placement is used.
- `js/solver.js` is kept for the feasibility pre-check and the seat-level repair search.
- Explanations probe at most 14 items within a time budget; the rest are marked as not probed.
- History before the lookback window (30 days) is not used by rest rules.
- Patterns are evaluated per plan; there is no cross-plan fairness for them.

## Deploy
This is a static site with no build step. On Vercel, serve the repo root: `.vercelignore` keeps the test pages, `docs/`, `scripts/` and `js/tests/` out of the deployment, and `vercel.json` adds the security headers. `index.html` also carries a Content-Security-Policy meta tag (no inline scripts or styles, same-origin only), so the policy holds on any static host.

`sw.js` and `manifest.webmanifest` make the app installable and usable offline. When you change any file listed in `sw.js`, bump the version in three places: `APP_VERSION` in `js/store.js`, `VERSION` in `sw.js` and the `?v=` query on every script, stylesheet and manifest link in `index.html`. The `ship: P5.4` test fails if they disagree or an asset is missing from the precache list. Open tabs show a toast *A new version is available* with an *Update now* button.

## Possible next steps
- People goals measured across several plans (e.g. "at most 2 far trips a month").
- Goal templates (e.g. "all hospitals monthly"); recurring fixed visits (every first Sunday).
- Comparing several plans side by side.
