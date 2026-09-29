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
js/engine.js          selection, packing, team assignment, gender repair, analysis, approve/undo
js/ui.js              popover stack, menus, sheet, dialog, toast, controls (Seg/Switch/Stepper/Slider/DaySet/MiniCal…)
js/io.js              XLSX writer/reader, CSV, import preview/apply, plan export, matrix sheet
js/views/plan.js      setup strip + List / Calendar / Matrix / Summary views, visit sheet, action bar
js/views/facilities.js  table, bulk actions, facility sheet, categories, locations
js/views/team.js      people cards, person sheet, groups & seats
js/views/rules.js     all rules with a sticky section nav (scroll-spy) and on/off status per section
js/views/data.js      import, unresolved names, backup/restore, appearance, reset
original/index.html   previous version (reference only)
```

## Features
- **Plan tab**: four summary tiles (Period, Workdays, Visits, Team). Each opens an in-place popover, so the page never expands, collapses or jumps. Generate/Regenerate button. Stale-plan banner.
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

## Possible next steps
- Undo history for manual plan edits; comparing several plans side by side.
