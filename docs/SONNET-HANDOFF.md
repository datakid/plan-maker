# People UI handoff

## Source and scope

Imported the static app and its full test.html script dependencies from datakid/plan-maker commit `5fa9c7f62f6d8773b4d138d9441525be5951b934`. The uploaded specification is preserved at `PLAN-FOR-SONNET.md`.

This workspace has project-file tools but no shell, git branch controls, configurable commits, archive builder or upstream GitHub write access. No `fix/people-ui` branch or per-task commits were created. The workspace platform saves changes automatically; this is not a claim that upstream GitHub was changed. Apply the focused diffs on that branch in the real repository and preserve the requested commit structure there.

## Implementation

Application changes are limited to:

- `js/views/team-table.js`: forwards popover refresh/onClose; uses actual editor refresh callbacks; shares rowFor across initial and targeted rendering; preserves row focus; delays row replacement while a popover is anchored in it, updates availability/off summaries in place, then flushes on close; restores chip focus after replacement; repaints full rows for panel edits; rebuilds grouping only for pool changes; preserves table scroll; adds page-wide class, drawer Escape stack registration, row toggle and opener focus return. Drawer overlay registrations/listeners are cleaned up when the layout is detached or replaced.
- `js/views/team.js`: cycle editor uses two columns with full-row anchor date; clear-off button is maintained dynamically even if the editor opened with no days off. This extra clear-button change is necessary because refreshing only on mode changes does not rebuild the clear action after a calendar pick. Calendar navigation and shift-range state remain intact when adding days.
- `css/app.css`: fixed inline-end drawer with scrolling body/pinned header; reserved table space >=1280px and no-scrim overlay at 980–1279px; internally scrolling table/sticky header; explicit 40px select-column offset; surface backgrounds; content-sized stepper inputs with fallback; nowrap segmented controls, stacked panel settings, and name ellipsis.
- `js/tests/phase5.js`: five requested regressions plus reusable scoped helpers. Docking assertion compares against the rendered root edges so a real scrollbar gutter is not mistaken for a drawer gap.
- `README.md`: People drawer behavior, checklist and verification entry paths.

No solver, model, persistence, app shell or translation files were edited after import. `js/ui.js` is unchanged: its existing refresh/onClose APIs were sufficient. No application-facing strings, dependencies, frameworks, build tools or code comments were added. Existing test-selected classes and public APIs remain available, including modal navigation when teamWide=false.

## Verification actually completed

`people-test.html` (isolated storage, four existing People tests + five new tests + uncaught-error check):

```
RESULT pass=10 fail=0
```

`docs/people-matrix.html` drives the actual app in an iframe at 1440, 1280, 1100 and 390px, both languages, both themes, first/last row. Desktop checks cover drawer geometry, header pinning, reserved table space, Escape/focus return, row toggle, sticky table header and cycle popover overflow; phone checks cover modal navigation and page overflow:

```
MATRIX pass=32 fail=0
```

Desktop screenshot of the actual Arabic light drawer was visually checked: non-modal, no scrim, edge-docked, table alongside, gender row and controls unclipped. The screenshot helper initially timed out on its selector before capturing the correct resized rendering; independent matrix geometry/interaction checks passed.

Phone screenshot was captured with actual mobile emulation at 390px and visually checked: modal sheet, readable fields and gender controls, no visible code or horizontal page overflow.

Screenshot references:
- Desktop: https://www.genspark.ai/api/files/s/5uY95zhx
- Mobile: https://www.genspark.ai/api/files/s/e8OrwEF0

These are NOT a full manual visual review of every matrix combination.

## Blocking release checks / next work

1. Full-suite baseline was attempted BEFORE application edits, but the complete suite exceeded the browser tool time limit. `docs/ui-fix-baseline.txt` records this honestly; no final baseline RESULT was obtained. The default-width attempt exposed the already documented pattern-goal editor failure. A 1280px wrapper produced no failure before timing out, but that is not a passing baseline.
2. In a normal desktop browser, run original source commit test.html at >=1280px until final RESULT, record every FAIL, then run the patched full test.html and compare. Require pass count >= baseline and no new failures. The focused suite does not establish this release condition.
3. Run the final visual sweep at all four widths, languages and themes, especially every panel field (pool regrouping, quota, skills, blocked facilities), nested popovers, and last-row/scroll interactions. Matrix coverage is automated and should not be represented as the requested full hand check.
4. Create the requested branch and per-task commits in the real git repository. Upstream files can be diffed against the pinned SHA above.
5. The solver review section's additional adversarial reference-solver fuzz logging and reduced-time-budget quarter comparison were NOT added. Keep them as test-only follow-ups; do not refactor engines during this UI release.

## Solver position

No new independent solver audit was performed in this workspace. The supplied review remains the working assessment: a heuristic scheduler with a shared validator, no optimality proof, and exhausted != infeasible. The biggest follow-up is visit insert/remove moves in LNS; then partial flow acceptance, incremental scoring, and centralized eligibility. Preserve validator and reference-oracle guards and ship these separately from UI fixes.

## Entry paths and storage

- `index.html#team`: normal app People page. Existing browser localStorage persistence remains unchanged (`alkhitta.v4`, language/theme/view preferences); there is no server database.
- `test.html`: unchanged full test runner.
- `people-test.html`: focused People regressions with in-memory isolated storage.
- `people-preview.html`: actual app with isolated storage, automatically opens People editor; optional `?lang=en&theme=dark` for visual inspection.
- `docs/people-matrix.html`: automated 32-case viewport matrix against people-preview.html.
- `docs/ui-check.html`: 1280px full-suite reporting wrapper; console forwarding is filtered, test logic/counters are unchanged.

Verification entries are development-only and need not be shipped. No hosted deployment or production data migration was requested or performed; no public deployment URL was created.
