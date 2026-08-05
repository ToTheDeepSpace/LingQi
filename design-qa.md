# Design QA

- final result: passed
- viewport: 390 x 844
- route: `http://127.0.0.1:4181/#/pages/mine/index?preview=checkin`
- source: `/Users/mima0000/.codex/generated_images/019ef612-9adf-77d3-8ff2-584e3db132c1/call_60ZBFLpWl9A8oz356JBIofs2.png`
- implementation: `/private/tmp/jumulu-checkin-v2-implementation.png`
- comparison: `/private/tmp/jumulu-checkin-v2-comparison.png`

## Comparison History

1. Initial implementation matched the selected streak-first structure, but the shared navigation hid the back action on the tab route.
2. Updated `MiniNavBar` so an explicit inline back action remains visible even when the host route is a tab page.
3. Re-captured at the same mobile viewport and compared source and implementation side by side. Hierarchy, seven-day strip, progress, primary action, invite tasks, ledger, and bottom navigation are aligned.

## Interaction Checks

- Tapping `签到并保住连签` changes the streak from 3 to 4, bonus balance from 86 to 96, and the action to `今日已签到`.
- Tapping `奖励明细` expands the reward ledger and exposes both mock transactions.
- The back action remains visible.
- Browser warnings and errors: none.

## Severity Check

- P0: none
- P1: none
- P2: none
