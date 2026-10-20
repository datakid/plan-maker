# v4 baseline (before the solver rewrite)

Measured on `main` at b2645a8 with the seed data, headless jsdom 30 under Node 22 (Chromium cannot be downloaded in the build sandbox).

## Tests

- `test.html`: pass=167 fail=0, no uncaught page errors, about 62 s in jsdom.
- No-comments check: 0 comments in every `.js`, `.css` and `.html` file.

## Generation timings (seed 1, seed data, Sun–Thu workdays)

| Window | Visits | Status | Hard | Soft | Time |
|---|---|---|---|---|---|
| Week (4–8 Oct 2026) | 5 | valid | 0 | 1 | 22 ms |
| Month (4–29 Oct 2026) | 20 | valid | 0 | 1 | 24 ms |
| Quarter (4 Oct 2026 – 7 Jan 2027) | 70 | valid | 0 | 1 | 49 ms |

The current greedy path never reaches search or annealing on these inputs, so the seed has no effect on its result.

## Fixture W1

`Fx.w1(opts)` in `js/tests/fixtures.js`: seed data, one week Sun–Thu (4–8 Oct 2026), perDay 1, fill mode, share 60%, Tuesday `lean = 'contracted'`. `opts.shuffle` randomises facility history with a seed, `opts.leans` sets other weekday leans.

## Bug reproduction

Plain W1 (history untouched) is honoured in 20/20 runs: Tuesday gets a contracted visit.

The bug appears as soon as facility history varies and more than one weekday leans. 200 random scenarios, each with a seeded random facility history and a random lean per weekday (at most 2 contracted-lean days and 3 basic-lean days, at least 1 contracted-lean day), fill mode, share 60%, perDay 1 (153 scenarios qualified):

| Measure | Result |
|---|---|
| Scenarios where at least one lean day is not honoured | 50 / 153 (32.7%) |
| Weekday lean settings not honoured | 53 / 424 (12.5%) |
| Scenarios with hard violations | 0 |

The validator reports no violation in any of these plans because `validatePlan` does not score lean. Examples (day-of-month and kind of each visit):

- Sun and Mon lean contracted: `04b 05c 06b 07c 08b`
- Mon lean contracted, Tue to Thu lean basic: `04b 05c 06b 07c 08b`
- Sun and Wed lean contracted, Thu lean basic: `04b 05c 06b 07c 08b`

Another run had three contracted-lean days against a share that allows only two contracted visits, and missed in 20/20; that case is a counting impossibility and is not counted as the bug.

## Targets for phase 3

- T1: W1 puts a contracted visit on Tuesday in 20/20 seeds with day.kind Prefer and with Must.
- T8: week < 400 ms, month < 1.5 s, quarter < 5 s on the seed data with 0 hard violations.
