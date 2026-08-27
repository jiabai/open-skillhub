# Desktop Home Review Card Full-Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task after human review. Steps use checkbox (&#x60;- [ ]&#x60;) syntax for tracking.

**Goal:** On wide Home (>= 1440px), make the review preview card span the full row width below the metrics region, aligned with the metrics' left and right edges, eliminating the empty left region.

**Architecture:** Keep the existing Home DOM and data flow unchanged. In the existing @media (min-width: 1440px) block, change `.home-layout__secondary` from `grid-column: 2` to `grid-column: 1 / -1` so both Home children span the two-column grid. Keep all narrower breakpoints on their current single-column flow.

**Tech Stack:** React 18, TypeScript 5.6, Vite, Vitest, Testing Library, CSS Grid, Electron renderer.

---

## Status

- Product spec: approved by the user on 2026-08-28 (updated in place from the right-rail variant).
- Implementation plan: approved by the user on 2026-08-28.
- Implementation: complete; the plan is archived with final documentation checks recorded below.
- Canonical spec: desktop-client/docs/product-specs/2026-08-28-home-review-card-placement.md.

## Scope decomposition

This is one small renderer-only plan because the change is limited to one existing
layout rule and its regression coverage:

1. Update the wide Home placement contract test to expect the full-row placement (RED).
2. Change the single wide-screen grid placement rule (GREEN).
3. Run focused and full Desktop validation.
4. Record completion in the local task tracker and archive this plan.

No Home component, data flow, API, IPC, persistence, i18n, or backend changes are
expected.

## File map

| File | Responsibility |
|------|----------------|
| desktop-client/src/styles.css | Wide Home grid placement: change `.home-layout__secondary` from column 2 to `1 / -1` inside the existing 1440px block. |
| desktop-client/src/__tests__/app.test.tsx | Update the existing wide Home placement contract test to expect the full-row rule and reject the old column-2 placement. |
| desktop-client/task-tracker.md | Completion record for the user-visible Home layout adjustment. |
| desktop-client/docs/exec-plans/active/index.md | Register the active plan during implementation. |
| desktop-client/docs/exec-plans/completed/index.md | Register the archived plan after all gates pass. |

## Decisions locked by the approved spec

- The existing wide breakpoint remains @media (min-width: 1440px).
- The existing grid-template-columns: minmax(0, 1.1fr) minmax(22rem, 0.9fr) remains the geometry source; `.home-layout__secondary` now spans `1 / -1`.
- The DOM order remains metrics first and review preview second.
- The review preview remains in normal flow; no fixed, sticky, overlay, or viewport-level footer is introduced.
- Breakpoints below 1440px retain their current stacked behavior.
- Existing Home preview content, loading/empty/error states, and Updates navigation remain unchanged.

## Implementation tasks

### Task 1: Update the wide Home placement regression

**Files:**

- Modify: desktop-client/src/__tests__/app.test.tsx at the existing "places the Home review preview below metrics in the wide right rail" test.

- [x] **Step 1: Update the contract assertions**

Rename the test to reflect full-row placement and change the `.home-layout__secondary` expectation from `grid-column: 2` to `grid-column: 1 / -1`, adding a negative assertion for the old placement:

~~~ts
it("places the Home review preview below metrics spanning the full row", () => {
  const styles = readFileSync("src/styles.css", "utf8")
  const wideStart = styles.indexOf("@media (min-width: 1440px)")
  const mediumStart = styles.indexOf("/* Medium workspace", wideStart)
  const wideStyles = styles.slice(wideStart, mediumStart)
  const homeStart = wideStyles.indexOf(".home-layout")
  const reviewWorkspaceStart = wideStyles.indexOf(".review-workspace__layout", homeStart)
  const homeStyles = wideStyles.slice(homeStart, reviewWorkspaceStart)

  expect(homeStyles).toContain(".home-layout__primary")
  expect(homeStyles).toContain("grid-column: 1 / -1")
  expect(homeStyles).toContain(".home-layout__secondary")
  expect(homeStyles).toContain("grid-column: 1 / -1")
  expect(homeStyles).not.toContain("grid-column: 2")
  expect(homeStyles).not.toContain("position: fixed")
  expect(homeStyles).not.toContain("position: sticky")
})
~~~

- [x] **Step 2: Run the focused test and verify RED**

Run:

~~~bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "places the Home review preview below metrics spanning"
~~~

Expected: FAIL because `.home-layout__secondary` still uses `grid-column: 2`.

### Task 2: Implement the full-row placement

**Files:**

- Modify: desktop-client/src/styles.css in the existing @media (min-width: 1440px) block.

- [x] **Step 1: Change the secondary placement rule**

~~~css
  .home-layout__primary {
    grid-column: 1 / -1;
  }

  .home-layout__secondary {
    grid-column: 1 / -1;
  }
~~~

- [x] **Step 2: Run the focused test and verify GREEN**

Run:

~~~bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "places the Home review preview below metrics spanning"
~~~

Expected: PASS.

### Task 3: Run renderer regression and completion validation

- [x] **Step 1:** `cd desktop-client && npm test -- src/__tests__/app.test.tsx` — PASS expected.
- [x] **Step 2:** `cd desktop-client && npm test` — full suite PASS expected.
- [x] **Step 3:** `cd desktop-client && npm run typecheck:electron` and `cd desktop-client && npm run build` — both exit 0.
- [x] **Step 4:** `python scripts/validate_agents_docs.py --level ERROR` and `git diff --check` — 0 errors, no whitespace errors.
- [x] **Step 5:** Visual check at >= 1440px (review card spans full row, aligned with metrics edges), 1100px-1439px and < 1100px (stacked order unchanged), plus empty and populated Home states.

### Task 4: Record completion and archive the plan

- [x] **Step 1:** Record validation evidence in this plan.
- [x] **Step 2:** Add one completed item under ## Done in desktop-client/task-tracker.md linking this plan.
- [x] **Step 3:** Move this plan to docs/exec-plans/completed/ and update both indexes; re-run documentation and diff gates.

## Progress

- [x] 2026-08-28: Product spec updated and approved for the full-row variant.
- [x] 2026-08-28: Updated the wide Home placement contract test and observed the expected failure at the old `grid-column: 2` rule.
- [x] 2026-08-28: Changed `.home-layout__secondary` to `grid-column: 1 / -1` in the existing 1440px block; focused test turned green.

## Validation Results

- `npm.cmd test -- src/__tests__/app.test.tsx -t "places the Home review preview below metrics spanning"` - FAIL first against the unmodified CSS as expected, then PASS after the CSS change.
- `npm.cmd test -- src/__tests__/app.test.tsx` - PASS, 48 tests.
- `npm.cmd test` - PASS, 38 test files and 228 tests.
- `npm.cmd run typecheck:electron` - PASS.
- `npm.cmd run build` - PASS, including renderer, Electron, and preload builds.
- `python scripts/validate_agents_docs.py --level ERROR` - PASS with 0 errors and 9 pre-existing warnings.
- `git diff --check` - PASS with no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.

## Risks and mitigations

- **Very wide review card hurts readability:** the card keeps its existing internal stacking and padding; visual check at the wide breakpoint confirms the preview list remains readable.
- **Medium/narrow layout regresses:** no default-layout or breakpoint changes; full renderer suite and three-band visual check guard against this.
- **A future change accidentally reintroduces the right-rail placement or viewport-fixed behavior:** keep explicit negative assertions for `grid-column: 2`, fixed, and sticky in the contract test.

## Plan self-review

- [x] Every approved product-spec requirement maps to a task.
- [x] File paths are exact and limited to the Desktop renderer/docs scope.
- [x] No backend, API, IPC, persistence, i18n, or unrelated page changes are implied.
- [x] Test names, CSS selectors, breakpoint values, and command paths are consistent.
