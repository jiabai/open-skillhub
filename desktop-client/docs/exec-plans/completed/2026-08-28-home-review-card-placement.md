# Desktop Home Review Card Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task after human review. Steps use checkbox (&#x60;- [ ]&#x60;) syntax for tracking.

**Goal:** Move the Home review preview below the metrics on wide screens while preserving the existing right-rail width and keeping the preview in normal document flow.

**Architecture:** Keep the existing Home DOM and data flow unchanged. Use the current wide-screen two-column CSS grid as a geometry source: make the metrics region span both columns, then place the existing review region in column 2 of the next auto-created row. Keep all narrower breakpoints on their current single-column flow.

**Tech Stack:** React 18, TypeScript 5.6, Vite, Vitest, Testing Library, CSS Grid, Electron renderer.

---

## Status

- Product spec: approved by the user on 2026-08-28.
- Implementation plan: approved by the user on 2026-08-28.
- Implementation: complete; the plan is archived with final documentation checks recorded below.
- Canonical spec: desktop-client/docs/product-specs/2026-08-28-home-review-card-placement.md.

## Scope decomposition

This is one small renderer-only plan because the change is limited to one existing
layout boundary and its regression coverage:

1. Add a failing CSS-layout contract test for the wide Home grid.
2. Add the minimum wide-screen grid placement rules.
3. Run focused and full Desktop validation.
4. Record completion in the local task tracker and archive this plan.

No Home component, data flow, API, IPC, persistence, i18n, or backend changes are
expected.

## File map

| File | Responsibility |
|------|----------------|
| desktop-client/src/styles.css | Wide Home grid placement: metrics span both columns and review preview occupies the existing right column on the next row. |
| desktop-client/src/__tests__/app.test.tsx | Regression coverage that the wide media block contains the intended Home placement rules and does not introduce viewport-fixed behavior. |
| desktop-client/task-tracker.md | Completion record for the user-visible Home layout adjustment. |
| desktop-client/docs/exec-plans/active/index.md | Register the active plan during implementation. |
| desktop-client/docs/exec-plans/completed/index.md | Register the archived plan after all gates pass. |
| desktop-client/docs/exec-plans/completed/2026-08-28-home-review-card-placement.md | Completed implementation plan and validation evidence. |

## Decisions locked by the approved spec

- The existing wide breakpoint remains @media (min-width: 1440px).
- The existing grid-template-columns: minmax(0, 1.1fr) minmax(22rem, 0.9fr) remains the source of the right-rail width.
- .home-layout__primary spans 1 / -1; .home-layout__secondary is placed in grid column 2.
- The DOM order remains metrics first and review preview second, so CSS auto-placement creates the second-row position without reordering content.
- The review preview remains in normal flow; no fixed, sticky, overlay, or viewport-level footer is introduced.
- Breakpoints below 1440px retain their current stacked behavior.
- Existing Home preview content, loading/empty/error states, and Updates navigation remain unchanged.

## Implementation tasks

### Task 1: Add the failing wide Home placement regression

**Files:**

- Modify: desktop-client/src/__tests__/app.test.tsx near the existing responsive CSS contract test.

- [x] **Step 1: Add a focused failing assertion**

Add a separate test that extracts the existing wide media block and asserts the
approved grid contract:

~~~ts
it("places the Home review preview below metrics in the wide right rail", () => {
  const styles = readFileSync("src/styles.css", "utf8")
  const wideStart = styles.indexOf("@media (min-width: 1440px)")
  const mediumStart = styles.indexOf("/* Medium workspace", wideStart)
  const wideStyles = styles.slice(wideStart, mediumStart)

  expect(wideStyles).toContain(".home-layout__primary")
  expect(wideStyles).toContain("grid-column: 1 / -1")
  expect(wideStyles).toContain(".home-layout__secondary")
  expect(wideStyles).toContain("grid-column: 2")
  expect(wideStyles).not.toContain("position: fixed")
  expect(wideStyles).not.toContain("position: sticky")
})
~~~

- [x] **Step 2: Run the focused test and verify RED**

Run:

~~~bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "places the Home review preview below metrics"
~~~

Expected: FAIL because the current wide media block only defines the two-column
container and does not assign grid columns to the Home children.

### Task 2: Implement the minimum wide-screen grid placement

**Files:**

- Modify: desktop-client/src/styles.css in the existing @media (min-width: 1440px) block after the .home-layout rule.

- [x] **Step 1: Add the approved placement rules**

Keep the existing column definition and add only these declarations:

~~~css
  .home-layout__primary {
    grid-column: 1 / -1;
  }

  .home-layout__secondary {
    grid-column: 2;
  }
~~~

The first child occupies the full first row. The second child is auto-placed into
column 2 on the next row, preserving the exact existing right-rail width without
a new pixel-based width or an empty placeholder component.

- [x] **Step 2: Run the focused test and verify GREEN**

Run:

~~~bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "places the Home review preview below metrics"
~~~

Expected: PASS.

- [x] **Step 3: Inspect the final CSS block**

Run:

~~~bash
rg -n -C 8 "\.home-layout|home-layout__primary|home-layout__secondary" desktop-client/src/styles.css
~~~

Confirm the new child rules are inside the existing min-width: 1440px block,
and that no new breakpoint or fixed/sticky positioning was added.

### Task 3: Run renderer regression and completion validation

**Files:**

- No additional production files are expected.

- [x] **Step 1: Run the full renderer integration suite**

Run:

~~~bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx
~~~

Expected: PASS, including Home empty/configuration/error states, the three-item
preview limit, Home-to-Updates navigation, and existing Updates workflows.

- [x] **Step 2: Run all Desktop tests**

Run:

~~~bash
cd desktop-client && npm test
~~~

Expected: PASS for the complete Desktop test suite.

- [x] **Step 3: Run Electron typecheck and production build**

Run:

~~~bash
cd desktop-client && npm run typecheck:electron
cd desktop-client && npm run build
~~~

Expected: both commands exit 0; the build must complete renderer, Electron, and
preload outputs without modifying tracked source files.

- [x] **Step 4: Run repository hard gates**

Run:

~~~bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
~~~

Expected: documentation validation reports 0 errors, and git diff --check reports
no whitespace errors. Any existing validator warnings should be recorded in the
completion notes rather than silently ignored.

- [x] **Step 5: Perform visual breakpoint checks**

Inspect the Desktop Home in the existing renderer/browser test surface at:

- >= 1440px: metrics occupy the first row; the review preview is on the right in
  the next row and has the same width as the former right rail.
- 1100px-1439px: content remains stacked with review preview after metrics.
- < 1100px: compact/single-column layout remains usable with no horizontal
  overflow or content overlap.

Also check empty data and configured data states. Confirm the review preview is
not fixed or sticky and that the View all updates action remains available.

### Task 4: Record completion and archive the plan

**Files:**

- Modify: desktop-client/task-tracker.md.
- Modify: desktop-client/docs/exec-plans/active/index.md.
- Move: desktop-client/docs/exec-plans/active/2026-08-28-home-review-card-placement.md to desktop-client/docs/exec-plans/completed/2026-08-28-home-review-card-placement.md.
- Modify: desktop-client/docs/exec-plans/completed/index.md.

- [x] **Step 1: Record implementation and validation evidence in this plan**

Before moving the file, update Status, Progress, and Validation Results with the
exact commands and observed outcomes. Use this shape:

~~~markdown
## Validation Results

- cd desktop-client && npm test -- src/__tests__/app.test.tsx - PASS.
- cd desktop-client && npm test - PASS.
- cd desktop-client && npm run typecheck:electron - PASS.
- cd desktop-client && npm run build - PASS.
- python scripts/validate_agents_docs.py --level ERROR - PASS with 0 errors.
- git diff --check - PASS with no whitespace errors.
~~~

- [x] **Step 2: Update the local task tracker**

Add one completed item under ## Done describing that Home now places the review
preview below metrics on wide screens while preserving the right-rail width, and
link the completed plan.

- [x] **Step 3: Archive the plan and update both indexes**

Remove the active-plan entry and add a completed-plan entry using the repository's
existing relative-link style. Do not leave a duplicate active copy.

- [x] **Step 4: Re-run documentation and diff gates after archiving**

Run:

~~~bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
~~~

Expected: 0 documentation errors and no whitespace errors.

The final post-archive run reported 0 documentation errors and 9 existing
warnings; git diff --check reported no whitespace errors.

## Progress

- [x] 2026-08-28: Product spec approved and committed as 7480e3e.
- [x] 2026-08-28: Implementation plan approved and committed as 15567c5.
- [x] 2026-08-28: Added the failing wide Home placement contract test and observed the expected failure.
- [x] 2026-08-28: Added the two approved wide-screen CSS grid placement rules.
- [x] 2026-08-28: Verified 1600px, 1280px, and 900px renderer layouts; wide Home uses the right rail on the next row, narrower widths remain stacked, and compact body scroll width does not exceed the viewport.
- [x] 2026-08-28: Updated the Desktop task tracker and archived this plan in the completed-plan index.

## Validation Results

- `npm.cmd test -- src/__tests__/app.test.tsx -t "places the Home review preview below metrics"` - PASS after the CSS implementation; the preceding run against the unmodified CSS failed at the missing `.home-layout__primary` rule as expected.
- `npm.cmd test -- src/__tests__/app.test.tsx` - PASS, 48 tests.
- `npm.cmd test` - PASS, 38 test files and 228 tests.
- `npm.cmd run typecheck:electron` - PASS.
- `npm.cmd run build` - PASS, including renderer, Electron, and preload builds.
- Renderer visual check - PASS at 1600px, 1280px, and 900px. At 1600px, primary bounds were 1320px wide and the secondary review region was 586.8px wide in the second row with `position: static`; at 1280px and 900px the regions were stacked. At 900px, body scroll width was 885px against a 900px viewport.
- `python scripts/validate_agents_docs.py --level ERROR` - PASS with 0 errors and 9 pre-existing warnings before final archival updates.
- `git diff --check` - PASS with no whitespace errors; Git reported expected LF-to-CRLF working-copy warnings.

## Outcome

Home now keeps its existing wide-screen two-column geometry while placing the
review preview below the full-width metrics region in the existing right rail.
No production API, IPC, persistence, or other page behavior changed.

## Spec coverage

| Spec requirement | Plan coverage |
|------------------|---------------|
| Review preview is below metrics on wide Home | Task 1 and Task 2 |
| Existing right-rail width is preserved | Task 2, Step 1; Task 3, Step 5 |
| Normal document flow; no fixed/sticky footer | Task 1, Step 1; Task 2, Step 3; Task 3, Step 5 |
| Existing preview content and navigation unchanged | Task 3, Step 1 |
| Narrower breakpoints remain usable | Task 3, Step 5 |
| Renderer tests and hard gates pass | Task 3 |
| Durable task tracking and active-plan archival | Task 4 |

## Risks and mitigations

- **Metrics become too wide at large sizes:** retain the existing internal
  .grid-3 metric layout and inspect populated Home at the wide breakpoint.
- **The review region is placed in the wrong row:** test the placement rules inside
  the existing wide media block and preserve the DOM order.
- **A future change accidentally makes the preview viewport-fixed:** keep explicit
  negative assertions for fixed and sticky positioning in the wide placement
  contract.
- **The medium/narrow layout regresses:** do not alter the default layout or add a
  new breakpoint; run the full renderer suite and three-band visual check.

## Plan self-review

- [x] Every approved product-spec requirement maps to a task.
- [x] File paths are exact and limited to the Desktop renderer/docs scope.
- [x] No backend, API, IPC, persistence, i18n, or unrelated page changes are implied.
- [x] Test names, CSS selectors, breakpoint values, and command paths are consistent.
- [x] No implementation placeholder remains in the execution steps.
