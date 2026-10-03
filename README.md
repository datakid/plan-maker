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
js/engine.js          capacity, scoring, team assignment (with preset people), gender repair, analysis, approve/undo
js/goals.js           goal & fixed-visit models, demand builder, goal progress, fixed-visit conflict checks
js/planner.js         generation pipeline: window → fixed visits → goal demand → selection → placement → teams → repair
js/ui.js              popover stack, menus, sheet, dialog, toast, controls (Seg/Switch/Stepper/Slider/DaySet/MiniCal…)
js/io.js              XLSX writer/reader, CSV, import preview/apply, plan export, matrix sheet
js/views/plan.js      setup strip + List / Calendar / Matrix / Summary views, visit sheet, action bar
js/views/facilities.js  table, bulk actions, facility sheet, categories, locations
js/views/team.js      people cards, person sheet, groups & seats
js/views/goals.js     goals editor (sheet + rules section), fixed-visit sheet, plan-strip popovers, progress block
js/views/rules.js     all rules with a sticky section nav (scroll-spy) and on/off status per section
js/views/data.js      import, unresolved names, backup/restore, appearance, reset
test.html             dev self-test (not needed in production)
```

## Goals (v3.1)
A list of goals, each switchable and marked **Must** (served first) or **Try** (served if there is room). Every goal has a scope: all, type, categories, locations, or specific facilities.
- **Cover**: visit every facility in scope N times, counted from a date. Optional *finish by* deadline: if it falls inside the plan, visits are placed before it; if it is later, the work is paced evenly up to it. *Start over* begins a new round once complete (moved forward on approve).
- **At least N** per plan for the scope.
- **At most N** per plan for the scope (hard cap on selection).
- **Max gap**: no facility in scope goes more than X days unvisited; due visits get a deadline.
The default is one goal: *Cover all facilities ×1, no deadline, Try*. This makes rotation coverage-aware without changing how many visits a plan has.

The engine merges all goals into a demand list (per facility: count, priority tier, deadline). Must goals come first, smaller goals before bigger ones, and the total is capped by the period's capacity. Leftover room is filled by the normal volume settings, which prefer facilities the goals still need. The Summary view shows progress for each goal. The Approve check flags unmet Must goals as a soft issue.

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

## Verification
- Automated pass over 43 steps: generation, all four views, visit sheet (swap/move/replace), setup tiles and nested popovers, export, approve/undo, every tab, facility/person sheets, rules add/edit, re-generation with rules (8/8 checks), import preview, XLSX write→read round-trip, v4 migration, coverage goal, English mode.
- Mobile (390px): no horizontal overflow on any tab, view or sheet; popovers clamped to the screen.

## Deploy
This is a static site with no build step. On Vercel, serve the repo root. You can drop `test.html`.

## Possible next steps
- Goal templates (e.g. "all hospitals monthly"); recurring fixed visits (every first Sunday).
- Undo history for manual plan edits; comparing several plans side by side.
