# al-Khitta v6 — Work plan for Sonnet

Repository: `datakid/plan-maker` (branch `main`). Reviewed files: `js/planner.js`, `js/requests.js`, `js/goals.js`, `js/people-rules.js`, `js/engine.js`, `js/lns.js`, `js/score.js`, `js/constraints.js`, `js/ui.js`, `js/views/goals.js`, `README.md`, `docs/SONNET-HANDOFF.md`.

Line numbers are from `main` at the time of review. They will move, so search by function name. Findings marked **CONFIRMED** were read directly in the code. Findings marked **VERIFY** are strong hypotheses: write a failing test that reproduces them before you change anything.

---

## 0. Rules for Sonnet (read before every phase)

### 0.1 Non-negotiable guardrails
1. **One validator.** `validatePlan` (`js/constraints.js`) decides validity, and every new rule must be reported there. Never add a second "is this OK" check that can disagree with it. Any new move or filter has to agree with the validator. Add a test that compares the two.
2. **Determinism.** The same data and seed must give the same plan. Use no `Math.random`, only the seeded `lnsRng`. Do not iterate a `Map`/`Set` in an order that depends on insertion when that order comes from wall-clock timing.
3. **Do not change engine and UI in the same PR.** Each phase below is its own PR with its own baseline comparison.
4. **No data loss.** Any change to the stored shape needs a migration in `store.js` and a `RULES_REV` bump. Load an old backup in a test and check that every person, facility, goal, override and history record survives. Never clear `localStorage` and never replace user records with seed data.
5. **Version bump.** If any file listed in `sw.js` changes, bump `APP_VERSION` (`js/store.js`), `VERSION` (`sw.js`) and every `?v=` in `index.html`. `ship: P5.4` checks this.
6. **CSP and offline.** No inline scripts or styles, no external requests, no CDN. New JS files must go into `index.html` load order, the `importScripts` list in `js/worker.js` (if the engine uses them) and the `sw.js` precache.
7. **House style.** No code comments in JS, CSS or HTML (release checklist item 10). Put every user-facing string in `js/i18n.js` in **both** Arabic and English. Support RTL and LTR, light and dark, and a 390 px width with no horizontal page scroll.
8. **Budgets.** Week under 400 ms, month under 1.5 s, quarter under 5 s (T8). The worker and inline paths must give the same plan.
9. **Do not weaken tests to make them pass.** If an existing test has to change, list it in `docs/v6-notes.md` with the reason. "The behaviour was the bug" is an acceptable reason. "It was flaky" is not.
10. **Stop and report** instead of guessing when a fix would change the objective for plans that do not use the feature you are fixing.

### 0.2 Regression protocol (every PR)
1. Before touching code, run on `main` and record the results in `docs/v6-baseline.txt`:
   - `test.html`: `RESULT pass=… fail=…`
   - `ship-test.html`, `people-test.html`, `docs/people-matrix.html`
   - `node scripts/ci-run.js` (all three parts)
   - **Golden plans** (new in P0): for each fixture × seed, the hard score, soft score, visit count, and the set of (date, facility) pairs and teams.
2. After the change, run all of them again. To merge:
   - pass count ≥ baseline, `fail=0`, no new uncaught errors;
   - K2 (generator vs reference) still ≥ 99% valid; K3 determinism holds; T8 budgets hold;
   - every golden plan is either **byte-identical**, or its change is listed in the PR as *intended* with the before/after score. A golden plan that changes without an explanation blocks the merge.
3. Add at least one new test per fixed bug. It must **fail on `main`** and pass on the branch. Paste both runs into the PR.

### 0.3 Global definition of done (applies to every phase)
- Phase-specific DoD met (listed per phase).
- Regression protocol passed.
- README and `docs/v6-notes.md` updated: what changed, decisions, deviations, and what is not done.
- Arabic and English, light and dark, and 1280 px and 390 px checked by screenshot for every UI change.
- No new console errors in `index.html`, `test.html` or the worker.

---

## P0 — Test harness for "user intent" (do this first; no behaviour change)

The current suite proves that plans are *valid*. It does not prove that plans do *what the user asked*. Every bug the user reported is an intent bug, so build the oracle first.

### Tasks
1. `js/tests/fixtures.js`: add **intent fixtures** built from the user's reports:
   - **F-SPX**: one special visit (facility A, location L1, window of 1 week, times 1) plus one fixed visit at facility B (location L2) inside that week. Run variants with `perDay` = 1, 2 and 3, special Must vs Prefer, with and without chosen people, and with the chosen people overlapping the fixed visit's people.
   - **F-4G2I**: 4 goals (cover a category, at least N in a location, at most N, special) plus 2 fixed visits, with volume mode Fill, Exact and Quota.
   - **F-POOL**: pool or person rules of the kind "never goes to location X" and "only goes to category Y".
2. Add `js/tests/intent.js` with property checks that run on **every** fixture × 20 seeds:
   - **I1** every active fixed visit in the window is in the plan, on its date, at its facility, with its locked people;
   - **I2** every special is placed `times` times inside its window with all its chosen people, **or** the plan carries a named, user-visible reason (`dSpecialNoDay` with a cause), never a silent skip;
   - **I3** no visit with `locked` people loses a locked person after LNS;
   - **I4** no special or fixed visit is moved outside its window by LNS;
   - **I5** when the volume mode is the new "goals only" (P2), every visit serves a goal, a special or a fixed visit;
   - **I6** goal-serving visits are not replaced by non-goal visits when an equivalent day exists (the score tier from P2).
3. Golden-plan snapshot tool: `js/tests/golden.js` writes and compares a compact JSON per fixture × seed, using explicit iteration caps so the result does not depend on the clock.

### Definition of done
- The intent tests exist and run in `test.html` under their own heading. They are **expected to fail on `main`** for I2, I3, I4 and I6. Record which ones fail in `docs/v6-baseline.txt`; those failures are the to-do list.
- The golden snapshots are recorded for `main`.

---

## P1 — Bug fixes (engine)

### P1.1 Special visit skipped when there is also a fixed visit — CONFIRMED (several causes)
User report: *"add special visit in the goals and add another location in the injected visits, it skipped one of them."*

Causes found in the code:

| # | Where | What happens |
|---|---|---|
| a | `planner.js` `generatePlanOnce`, the fixed-visit loop and `canPlace` (`load[d] >= dayCap(ord)`) | Fixed visits are placed first and consume the day cap. With `perDay` = 1 (or a day cap) and a special whose window contains only that day, `canPlace` refuses every day. The special is dropped with `dSpecialNoDay`, which goes into `genDiags` and is easy to miss. |
| b | `planner.js` specials loop (`for(const {r, copy} of specials)`) | Greedy, one copy at a time, with no backtracking. Special 1 can take the only day special 2 could use. A matching step already exists for "every day" (`tryAug`) but is not used for requests. |
| c | `canPlace` seat check (`seatUse + need > avail`) | **VERIFY** whether a fixed visit with `fill=false` reserves the *default* seats of every pool (through `resolveRequestSeats` → `plannedSeats`) instead of only the picked people. If it does, it eats seats the special needs. |
| d | `canPlace` preset check (`hardOk` for each `u.people`) | If the special's chosen people are also on the fixed visit, that day is blocked for them. That is correct, but the message does not say so. |
| e | `lns.js` `lnsMoves`: `live = plan.visits.filter(v=>!v.fixed…)` | **Specials are in `live`.** `N4day` and `N4swapDays` move them to *any* plan day, ignoring `window`. `N3restaff` calls `lnsRestaff(plan, {...v, team:{}})`, so `cur` is empty and the `keepFixed && v.locked` branch never runs. **The chosen people are dropped.** `N3hungarian` reassigns a whole pool ignoring `locked`. `N3chain` drops the last member (`cur.slice(0,-1)`), which may be locked. In the validator, a special only counts with *all* chosen people inside the window, so after these moves it counts as missing. |
| f | Score trade-off | A **Prefer** special costs weight × units = 5 per missing visit in `softScore`. The due-ness reward (`score.js` `evaluateState`, subtracted from soft) and other Prefer terms can outweigh it, so LNS accepts losing it. |
| g | `goals.js` `normalizeGoal` / `normalizeOverride` | `dupChoice` keeps only `merge` and `keep`; **`reject` is silently dropped** on reload. A small bug, but it changes which request survives. |
| h | `constraints.js` special row | **VERIFY**: the window is `g.from`/`g.to`/`within` without clamping to the plan window. A special whose window is entirely outside this plan may be reported as short (a hard violation if Must) while `compileRequestsRaw` skipped it. Expected: state `new` / not applicable, no violation. |

Fix:
1. **Requests are protected visits.** Give every visit produced from a request (`fixed` or `special`) a `protect` record: `{window:{lo,hi}, locked:[…], facilityId}`. In `lns.js`:
   - `N4day` and `N4swapDays` only pick dates inside `protect.window`, skipping the move when there are none;
   - `N4facility`, `N5remove` and `N5swapInsert` never touch protected visits (specials are already excluded from some of these; make this one predicate `lnsProtected(v)`, used everywhere);
   - `lnsRestaff`, `N3restaff`, `N3hungarian`, `N3chain`, `N3person` and `N3swap` always keep `locked` ids in their seats. Pass `team: lockedOnly(v)` instead of `{}` and give locked seats cost 0 / fixed in the Hungarian matrix.
2. **Place requests with matching instead of greedy.** Build a bipartite graph of (request copy) × (feasible day). Use augmenting paths (reuse the `tryAug` pattern) or `flow.js`, tier 0 first, then tier 1. Copies of one request must land on distinct days and keep the spread target as a tie-break cost.
3. **Day cap vs requests.** Add a setting, *"User-requested visits may exceed the daily cap"*, default **on**. When on, specials can use a day whose cap is filled only by fixed or special visits, and `day.cap` is reported as an **exception** (like a fixed visit's locked people) instead of a hard violation. When off, the skip must produce a **hard, visible** conflict naming the special, the day, and the fixed visit that took the room, plus a one-click fix ("allow 2 visits on that day" / "widen the window").
4. Persist `dupChoice:'reject'` (g).
5. Clamp the validator's special window to the plan window (h). When nothing of the window is inside the plan, the row is `new` with no violation.

DoD: on F-SPX, every variant either places both visits or reports a hard conflict that names the cause, for all 20 seeds. I2, I3 and I4 pass. No golden plan without requests changes.

Tests: a new regression `R-SPX-1…6` (one per variant), plus an LNS unit test that runs 5,000 moves on a plan with a locked special and asserts the window and locked people after every accepted move.

### P1.2 "4 goals + 2 fixed, but it adds its own random places" — CONFIRMED
Causes:
1. **Fill mode always fills to the volume target.** `selectUnits` → `fillFrom(ranked.basic, wB)` / `ranked.contracted` adds the most overdue facilities until `prev.basic` / `prev.contracted` is reached. If the goals need fewer visits than the volume, the rest is "random" to the user.
2. **Try cover goals without a deadline create no demand.** `buildDemand`: `if(goalMust(g)) ob(…) else prefer(r.f, g.id)`. A Try cover goal only reorders the filler (tier 2) and is never guaranteed a slot.
3. **The flow treats tier ≥ 2 as free.** `flowStage`: `freeSeq = seq.filter(u=>u.tier>=2…)`. These units go into the candidate pool, where a goal-preferred facility competes with *all* facilities on `reward = wDue·rank + gw`. Due-ness can beat the goal.
4. **LNS can replace goal visits.** `N4facility` swaps the facility of any non-special visit for a random same-category facility not in the plan. `N5swapInsert` removes any non-fixed, non-special visit and inserts a random facility (`lnsInsertSlot`). Only the soft score guards goal visits, and the due reward is subtracted from it.
5. **Capacity drop.** `selectUnits`: `if(units.length>=room){ dropped++ }` drops goal slots when `room` (from `capacityOverMax`) is too small, with only a warning.
6. **The everyDay extra** (`requireEveryEligibleDay`) adds top-ranked non-goal facilities.

Fix (this is the core change for P2, listed here so the bug has an owner).

---

## P2 — Intent hierarchy in the objective (engine)

### Design
Change the score from `(hard, soft)` to **`(hard, intent, soft)`**, compared lexicographically:
- `hard`: unchanged (structural + Must).
- `intent`: **new**. Units the user explicitly asked for that are missing, even when they are Prefer: missing special copies, missing fixed visits, Prefer cover / at-least shortfall, missing pinned facilities. Weighted by the item's weight. A Prefer goal stays "not blocking approval", but the search can no longer trade it for due-ness or spread.
- `soft`: the remaining preferences minus the due reward.

The weight of a Prefer goal still matters *between* intent items. The due reward must never pay for an intent unit.

### Tasks
1. `validatePlan` returns `intentScore` (sum over violations whose rule is in `INTENT_RULES` = `goal.special`, `goal.cover`, `goal.atLeast`, `fac.pinned`, and fixed-visit date/facility if not already structural, and only when the level is Prefer). Leave `softScore` the same for all other terms and remove the intent rules from it, so nothing is counted twice. Add a test that `hardScore + intentScore + softScore` covers every violation exactly once.
2. `score.js` `makeState` / `evaluateState` / `applyMove` delta: carry `intent`. `lns.js` acceptance (Late Acceptance) compares the tuple, never only soft. `planner.js` "better" checks (`generatePlan`, the search, polish, `continueSearch`) compare the tuple. **Search for every `hardScore<` and `soft<` comparison** and replace it with one `cmpScore(a,b)` helper.
3. Demand: Try cover goals without a deadline create **tier 1 obligations** (not only `prefer`) up to capacity, so they get slots before filler.
4. Flow: tier 1 units are never in `freeSeq`. Tier 2 (goal-preferred filler) gets `reward += intentBonus`, which is larger than the maximum due reward.
5. **New volume mode: "Only what I asked"** (`volume.fill = 'goals' | 'fill'`, default `'fill'` so old data behaves the same). In `goals` mode, `selectUnits` skips `fillFrom`, the everyDay extra is not added, and `N5insert` / `N5swapInsert` cannot add non-goal facilities. UI: a 2-option segmented control on the Visits tile: *"Fill remaining days" / "Only my goals and visits"*.
6. When the goals need more than capacity (cause 5), the plan shows a **hard** conflict card with a fix ("raise visits per day to N" / "extend the period"), not a toast-level warning.
7. Summary: a new *"Why is this visit here?"* tag on each visit: `Fixed`, `Special`, `Goal: …`, `Filler (overdue)`. The user can see at a glance which visits are their own and which the engine added.
8. Migration: `RULES_REV` 10 adds `volume.fill='fill'`. The objective change affects every plan with goals, so **golden plans will change**. Document each one with old and new (hard, soft) and the new intent score.

### Definition of done
- F-4G2I: in `goals` mode, I5 holds (every visit serves a request or goal) on all seeds. In `fill` mode, all 4 goals and 2 fixed visits are met when capacity allows, and the filler only uses the remaining room (I6).
- K2 ≥ 99%, K3 and T8 hold.
- T5 (score equals the validator on 200 fixtures) extended to the 3-tuple.
- The Equation card (`buildModel`, `modelText`) shows the intent tier, and its totals still equal the search score.

### Tests
- `R-INT-1`: a Prefer special vs a high due reward; the special must win.
- `R-INT-2`: a Try cover goal with no deadline is fully covered when capacity allows.
- `R-INT-3`: in `goals` mode no inserted visit has `why.tier===3`.
- `R-INT-4`: in `fill` mode with a total volume of 20 and goals needing 8, exactly 8 goal visits plus 12 filler visits.
- Weight monotonicity T9, extended: raising a Prefer goal's weight never lowers its met count.

---

## P3 — Simple rules: "this team/pool never goes there / only goes there"

What exists: the person goal `type:'person'` with `rel:'never'|'only'` and a scope (all / type / category / location / facility). It is per person, compiled in `compilePeopleRules` into `deny`. Missing: a **pool** or **group** as the subject, and a fast way to write the rule.

### Design
1. Extend the person goal with `subject: {kind:'people'|'pool'|'group', ids:[…]}`. The old `people` stays and migrates to `subject:{kind:'people', ids:people}`.
2. `compilePeopleRules`: expand the subject to the people who are **currently active** at compile time, so a new member of a pool inherits the rule. The `deny` entries keep `gid` so `deniedBy` and the validator still report the goal.
3. Facility-side shortcut, the same rule seen from the place: *"Only pool X visits location Y"* = deny every pool except X on scope Y. Store it as the same goal type (`rel:'only'` with the subject inverted is confusing; use `rel:'reservedFor'`) and compile it into denies.
4. **Rule sentence builder**: a single row UI.
   `[Subject ▾ person / pool / group] [never goes to / only goes to / prefers not] [Scope ▾ location / category / type / facility] [Must | Prefer]`
   It appears in: the Goals manager "Add" menu (first item, *"Simple rule"*), the person drawer (*Rules* tab), the facility and location sheets (*"Who may visit"*), and the command palette (P6).
5. Conflict check before saving: if the rule leaves a scope with no eligible person for a needed pool, or empties a person's possible places, show it inline ("Nobody from pool *Admins* may visit *Location X*; 6 facilities there need an admin seat"). Also add it to `preflightPlan` as a **proven** conflict when Must.

### Definition of done
- F-POOL: "pool Admins never goes to location X" holds on all seeds. A person moved into the pool afterwards is also denied. The validator reports a breach with the goal's name.
- Old person goals load unchanged (migration test with a rev-9 backup).
- The sentence builder can create every combination in both languages and at 390 px.

### Tests
- `R-RULE-1…4`: never / only / reservedFor / prefer-not, per pool and per group.
- `R-RULE-5`: the infeasibility proof when a Must rule empties a required pool.
- Phase-2 style test: flip each new rule between Must and Prefer.

---

## P4 — Algorithm and equation review: remaining findings

Do these after P1–P2, one PR each, each behind the regression protocol.

| ID | Where | Finding | Action |
|---|---|---|---|
| A1 | `score.js` `evaluateState` | The due reward is subtracted per visit, so **every extra visit lowers soft**. In "Up to" mode this pushes the search toward more and more overdue visits regardless of what the user asked. | Cap the reward per facility, and in `goals` mode set the reward to 0 for non-goal facilities. Make sure the reward is never bigger than one intent unit (P2). |
| A2 | `lns.js` `lnsInsertSlot` | Ignores `day.only`, the weekly cap, quota categories and `atMost` caps. It also never adds a second copy of a facility already in the plan, so cover ×2 goals cannot be repaired by insert. | Use the same `canPlace` predicate as the planner (extract it out of `generatePlanOnce` into a shared `placementOk(plan, f, date)`). |
| A3 | `planner.js` `canPlace` closure | Placement eligibility exists in three variants: the `canPlace` closure, flow `cost()` and the LNS filters. They already disagree (e.g. `seniorOkOn` is skipped for requests and `cost()` checks it, and LNS checks neither). | One `eligibility.js` module used by all three. This was already on the earlier handoff's to-do list as "centralised eligibility". |
| A4 | `planner.js` flow candidate filter | `if(sel.caps.some(c=>inScope(x.f, c.scope))) continue;` drops **every** facility in the scope of **any** at-most goal from the candidates, even when the cap has room left. | Check `c.left>0` instead. |
| A5 | `planner.js` `dayCap` (`engine.js`) | `c.cap!=null ? Math.min(c.cap, v.perDay||1) : (v.perDay||1)`. With `perDay` 0 or unset the cap silently becomes 1. | Treat 0 as "no visits" or validate it in the UI. Decide, document, and test. |
| A6 | Stepper default for `times` | See P5.1: `cur==null` and decrement → `set(max)`. A goal with no `times` jumps to 20. | Fixed in P5.1. |
| A7 | `planner.js` team assignment "moved" branch | It moves a non-preset visit to another day when seats are open, but ignores the visit's `softLimit` and goal window. | Respect `softLimit` / goal windows, or only move within them. |
| A8 | `requests.js` `mergeRequests` | When the windows do not intersect (`lo>hi`) it falls back to the base window, so one request's window is silently broken. | Don't merge non-intersecting windows. Keep both and report. |
| A9 | `explain.js` | Probes at most 14 items. With intent items now first-class, probe intent shortfalls before soft items. | Order the probes by tier. |
| A10 | `generatePlan` retry | `flowPartial:false` runs a second full generation (twice the time) whenever any unit rolled back, even when the first run is valid on hard but worse on intent. | Only retry when `hard>0 || intent>0`, and count the time in the budget. |

DoD for each: a failing test first, then the fix, then the regression protocol. A1 and A4 will change golden plans; explain each change.

---

## P5 — UI fixes

### P5.1 Stepper: "you have to press + before − works" — CONFIRMED
In `js/ui.js` `Stepper`:
- `paint()`: `dec.disabled = opts.nullable ? cur==null : …`. **For every nullable stepper without `base`, − is disabled while the value is empty**, even though a default number is shown (as the placeholder). You must press + first. This affects, for example, `patMaxRun` (no limit), seat steppers when the facility is not yet chosen, and any per-person or per-day override that shows the inherited value.
- `dec` click: `if(cur==null) set(max<999?max:min, true)`. Pressing − on an empty value **jumps to the maximum** (e.g. 20 or 60).
- Some callers pass `undefined` (e.g. `Stepper(g.times, …)` in `views/goals.js`), which has the same effect.

Fix:
1. The Stepper always works from the **effective value**: `eff = cur ?? opts.base ?? opts.fallback ?? min`. − gives `eff-step` and + gives `eff+step`. Only disable a button at the real `min` / `max`.
2. For nullable steppers, show the inherited value as the input value with a muted style plus an "inherited" chip (not only as a placeholder). The first click turns it into an explicit value. A *Default* button (already present for seats) sets it back to `null`.
3. "No limit" steppers (`maxRun`): − from "no limit" goes to `max` only if that is the documented meaning. Otherwise use a separate *No limit* switch. Decide this and write it down; do not keep both behaviours.
4. Audit **every** `Stepper(` call (search the repo). Each nullable caller must pass `base`. Callers whose value may be undefined must pass a number.
5. Optional: press-and-hold to repeat, and the mouse wheel when focused.

DoD: a new UI test that, for every Stepper instance reachable from the Plan tiles, the person drawer, the goals manager and the Rules sections, clicks − once on a fresh control and expects `effective − step` (or `min`). Pass on 1280 and 390 px.

### P5.2 People tab redesign
Problem: you scroll down, then scroll sideways, then open a third panel to expand. There is no search.

Target layout (master-detail, no horizontal scroll):
1. **Toolbar**: a search field (name, phone, pool, skill, notes; Arabic-normalised with the existing `norm()`; `/` focuses it), filter chips (pool, gender, status active/retired, *has rules*, *unavailable this period*, *over quota*), sort (name, load, last visit), a group-by toggle (pool / none), and a count ("12 of 40").
2. **List**: one compact row per person showing the name, pool badge, gender, availability summary (e.g. "Sun–Thu" / "2 on 2 off"), this plan's load vs expected as a small bar, and rule badges (count of rules, with a red dot if one is broken). No more editable columns in the list itself. Select multiple with checkboxes for the bulk bar (which already exists).
3. **Detail drawer** (keep the existing docked drawer behaviour from the earlier PR: inline-end, non-modal at ≥980 px, modal sheet below that) with **tabs** instead of one long form:
   - *Profile* (name, pool, gender, skill, origin, distance)
   - *Availability* (weekdays/cycle, days off calendar, max run, max per week)
   - *Rules* (the P3 sentence-builder rules for this person, quota, pairs, blocked facilities)
   - *Activity* (visits in this plan, history, fairness)
   Each tab remembers its scroll position. Arrow keys move between people while keeping the tab.
4. Optional *Table view* toggle for power users. It keeps the current table, with a column chooser so it fits without sideways scrolling.

Guardrails: keep every existing test-selected class and public API, or update the tests in the same PR and list them. `people-test.html` and `docs/people-matrix.html` must still pass; extend the matrix to cover search and filters. No engine files change in this PR.

DoD: find a person by part of their name in Arabic or English in one keystroke sequence. Open their availability with no horizontal scroll at 1280 and 390 px. All People tests pass, plus new tests for search, filter, tab persistence and keyboard navigation.

### P5.3 Settings / Rules findability
1. One **settings index**: a generated list of every setting (rule id, section, i18n labels in both languages, keywords and synonyms, DOM anchor). Build it from the rule registry (`rules-model.js`) plus the non-rule settings (calendar, volume, distance, appearance, data). The palette (P6) uses the same index.
2. The Rules search box searches this index (labels, help text and synonyms in both languages), scrolls to the match, opens its section and **highlights** the control for 2 s.
3. Every setting gets a stable deep link (`#rules/vol.week`, `#data/backup`), so the palette, the conflict cards and explanations can link straight to the control.
4. Show "changed from default" dots on sections and a *Show only changed* filter.

DoD: every rule id in the registry can be found by its English and Arabic name and opened in at most 2 actions. A test iterates the registry and checks that each entry resolves to a visible element.

---

## P6 — Command palette (Ctrl/Cmd+K)

### Design
- New `js/palette.js` (UI only, no engine changes). Open it with `Ctrl/Cmd+K`, or `/` when no input has focus, plus a search button in the top bar for touch. Built on the existing popover/dialog stack in `ui.js`, so Escape, focus return and RTL already work.
- **Command registry**: `Palette.register({id, group, title:{ar,en}, keywords:{ar:[],en:[]}, icon, when:()=>bool, run:(arg)=>void, hint})`. Groups and examples:
  - *Actions*: Generate, Regenerate, Keep searching, Approve, Undo approve, Export XLSX/CSV, Print, Undo/Redo, toggle theme or language.
  - *Go to*: each tab and view (List, Calendar, Matrix, Summary), each Rules section, each setting from the P5.3 index.
  - *Find*: people, facilities, locations, categories, goals, fixed visits, and visits in the current plan (by facility or date). Selecting one opens its sheet or drawer.
  - *Create*: "Add special visit…", "Add fixed visit on…", "Add simple rule…" (opens the P3 builder prefilled with whatever was typed), "Add person", "Add facility".
- **Matching**: fuzzy, using the existing Arabic `norm()` (alef/yaa/taa marbuta folding, digits via `toAsciiDigits`), with prefix and word-start boosts. Show recent and frequent commands when the query is empty, stored in `localStorage` under a **new** key `alkhitta.palette.v1` (never inside the data keys).
- **Light parsing** (optional, phase 2 of the palette): `special <facility> <date>`, `fixed <date> <facility>`, `<person> never <location>`. These open the matching sheet *prefilled*. They never save without the user confirming.
- **Accessibility**: `role="dialog"`, an input with `role="combobox"` and `aria-activedescendant`, a `listbox` of results, ↑/↓/Enter/Escape, Tab to switch groups. Works at 390 px as a full-width sheet.

### Guardrails
- The palette only calls existing view or controller functions. It does not mutate data directly, so undo/redo and the one-writer storage guard still apply.
- Opening the palette makes no layout shift and no network request. It must open in under 50 ms with 500 facilities.
- Keyboard shortcuts must not fire while an input, textarea or contenteditable has focus (except `Ctrl/Cmd+K`).

### Definition of done
- Every tab, every rule (through the P5.3 index), every person and every facility can be reached from the palette.
- Arabic and English queries both work, including no-diacritic and alef-variant spellings.
- Tests: open/close, focus return, a query → expected top result (20 cases in each language), run Generate from the palette, open a person, create a special via the palette prefill, and the 390 px layout.

---

## Order and size

| Phase | PR | Touches | Golden plans may change? |
|---|---|---|---|
| P0 | intent harness + golden snapshots | tests only | no |
| P1.1 | requests protected in LNS + matching placement + day-cap option | lns.js, planner.js, requests.js, goals.js, constraints.js | only fixtures with specials or fixed visits |
| P5.1 | Stepper fix | ui.js (+ callers) | no |
| P2 | intent tier + "only my goals" mode | constraints.js, score.js, lns.js, planner.js, goals.js, store.js (migration), views | yes, documented |
| P3 | pool/group rules + sentence builder | people-rules.js, goals.js, engine.js, constraints.js, views | only rule fixtures |
| P4 | A1–A10, one PR each | engine | per item, documented |
| P5.3 | settings index + deep links | rules view, new index file | no |
| P6 | command palette | new palette.js, app.js, i18n | no |
| P5.2 | People redesign | team-table.js, team.js, css | no |

Do P5.1 early because it is small and the user hits it daily. Do P1.1 before P2 because P2's new score tier depends on the protected-request predicate.

## Manual acceptance script (for the user, after each phase)
1. Add a special visit (facility A, next week) and a fixed visit (facility B, a different location, one day in that week). Generate 5 times with *Regenerate*. Both appear every time, with the special's chosen people.
2. Set 4 goals + 2 fixed visits, choose *"Only my goals and visits"*, and generate. Every visit is tagged Fixed, Special or Goal, with no filler.
3. Switch to *"Fill remaining days"*. Goal visits are still there, and filler is tagged *Filler*.
4. Add *"Pool Admins never goes to Location X"* and generate. No admin appears at Location X. Add a new admin and regenerate; the rule still holds.
5. Open any stepper and press − first. It goes down by one from the shown value.
6. People tab: type part of a name, open *Availability*. No horizontal scroll.
7. Press Ctrl/Cmd+K, type a rule name in Arabic, press Enter. The control is shown and highlighted.
