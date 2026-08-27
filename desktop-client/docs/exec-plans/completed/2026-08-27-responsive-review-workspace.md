# Responsive Desktop Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified responsive desktop Shell for Home, Updates, Local Skills, and Projects, with safe Renderer-orchestrated multi-select distribution on Updates.

**Architecture:** Keep Electron IPC and the existing single-skill distribution service unchanged. Add a pure Renderer batch-planning/execution module, let `App.tsx` own orchestration state, and compose focused responsive view components around the existing domain callbacks. Shared Shell and CSS establish the three breakpoints; page-specific components decide whether to show summaries, details, master-detail content, or the Updates-only approval bar.

**Tech Stack:** React 18, TypeScript 5.6, Vite, Vitest, Testing Library, local CSS design tokens, lucide-react, Electron typed preload bridge.

---

## Status

- Product spec: approved on 2026-08-27.
- Implementation: complete on 2026-08-27; all implementation batches and completion documentation are recorded below.
- Canonical spec: `desktop-client/docs/product-specs/2026-08-27-responsive-review-workspace.md`.
- Review gate: satisfied; the implementation was approved before execution and the completed plan is archived with validation evidence.

## Scope decomposition

This is one plan because all four page changes depend on the same Shell, responsive breakpoints, tokens, and navigation behavior. Work remains reviewable through independently verifiable batches:

1. Pure batch-distribution state and execution.
2. App orchestration and confirmation flow.
3. Updates workspace components.
4. Shared responsive Shell.
5. Home migration.
6. Local Skills migration.
7. Projects migration.
8. Full accessibility, responsive, and documentation gates.

No batch IPC, backend API, database, Agent adapter, or filesystem-write changes are permitted by this plan.

## File map

| File | Responsibility |
|------|----------------|
| `src/core/review/batch-distribution.ts` | Pure eligibility, default selection, stable ordering, batch execution, and result aggregation |
| `src/__tests__/batch-distribution.test.ts` | Unit coverage for batch eligibility and continuation after failure |
| `src/app/App.tsx` | Top-level selection, confirmation, progress, activity, refresh-once orchestration |
| `src/components/updates-review-workspace.tsx` | Updates page composition and responsive table/card rendering |
| `src/components/review-summary.tsx` | Selected count, blocked count, target count, last-check summary |
| `src/components/review-action-bar.tsx` | Updates-only sticky action bar and selection controls |
| `src/components/app-shell.tsx` | Shared sidebar, navigation, global actions, execution-time navigation lock |
| `src/components/home-view.tsx` | Read-only review preview and route to Updates |
| `src/components/local-skills-view.tsx` | Inventory plus selected-group contextual detail |
| `src/components/projects-view.tsx` | Responsive project master-detail composition |
| `src/i18n/messages/{types,en-US,zh-CN}.ts` | All new visible copy and accessible labels |
| `src/styles.css` | Shared Shell, three breakpoints, page layouts, action bar, reduced-motion rules |
| `src/__tests__/app.test.tsx` | Renderer integration tests for navigation, selection, confirmation, progress, errors, and preserved page operations |
| `docs/DESIGN.md` | Durable page layout and batch interaction rules after implementation |
| `docs/ARCHITECTURE.md` | Renderer-only batch orchestration boundary after implementation |
| `task-tracker.md` | Current execution status and final validation evidence |

## Decisions locked by the approved spec

- Safe default selection requires a fresh pre-distribution snapshot, at least one target, no global error, no missing target result, no per-target `error`, and at least one target not already `installed`.
- An item whose every target is already `installed` remains a local-record reconciliation action and is not selected for filesystem distribution.
- Selection is ephemeral and is recomputed after a new review/precheck snapshot.
- A rejected Promise for one Skill is a failed item; a resolved distribution result with failed Agent IDs is a partial item. Both allow the batch to continue.
- The batch refreshes review state once after all selected items run. Activity still records each item and adds one summary entry.
- Home does not distribute directly; it routes to Updates.
- “Reject all” is not implemented.

## Task 1: Add the pure batch-distribution controller

**Files:**

- Create: `desktop-client/src/core/review/batch-distribution.ts`
- Create: `desktop-client/src/__tests__/batch-distribution.test.ts`

- [x] **Step 1: Write failing eligibility and execution tests**

Create fixtures for one fresh eligible item, one all-installed item, and one item with an `error` target. Cover default selection, stable input order, partial results, thrown failures, progress callbacks, and continuation.

```ts
import { describe, expect, it, vi } from "vitest"

import {
  createDefaultBatchSelection,
  getBatchEligibility,
  runDistributionBatch
} from "@/core/review/batch-distribution"
import type { PendingSyncUpdate, PreDistributionCheckSnapshot } from "@/types"

const update = (id: string): PendingSyncUpdate => ({
  remoteSkillId: id,
  name: `Skill ${id}`,
  localVersion: null,
  localContentHash: null,
  remoteVersion: "1.0.0",
  remoteContentHash: `hash-${id}`,
  reason: "not-installed"
})

const snapshot = (comparisons: Record<string, "not-installed" | "installed" | "update" | "error">): PreDistributionCheckSnapshot => ({
  results: Object.fromEntries(Object.entries(comparisons).map(([id, contentComparison]) => [
    id,
    {
      codex: {
        agentId: "codex",
        displayName: "Codex",
        skillDir: "D:/skills",
        exists: contentComparison !== "not-installed",
        installedVersion: null,
        installedVersionSource: null,
        installedContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: `hash-${id}`,
        installedVersionFormat: "semver",
        remoteVersionFormat: "semver",
        contentComparison,
        checkedAt: "2026-08-27T00:00:00.000Z",
        durationMs: 1,
        errorCode: contentComparison === "error" ? "READ_FAILED" : null,
        errorMessage: contentComparison === "error" ? "Read failed" : null
      }
    }
  ])),
  checkedAt: "2026-08-27T00:00:00.000Z",
  expiresAt: "2026-08-27T01:00:00.000Z",
  pendingUpdateFingerprint: "fixture",
  targetAgentIds: ["codex"],
  totalDurationMs: 1,
  globalErrors: []
})

describe("batch distribution", () => {
  it("selects only fresh writable updates", () => {
    const updates = [update("eligible"), update("installed"), update("blocked")]
    const check = snapshot({ eligible: "update", installed: "installed", blocked: "error" })

    expect(getBatchEligibility(updates[0], check, false)).toBe("eligible")
    expect(getBatchEligibility(updates[1], check, false)).toBe("installed")
    expect(getBatchEligibility(updates[2], check, false)).toBe("blocked")
    expect(createDefaultBatchSelection(updates, check, false)).toEqual(["eligible"])
  })

  it("continues in input order after partial and rejected items", async () => {
    const distribute = vi
      .fn()
      .mockResolvedValueOnce({ failedAgentIds: ["codex"] })
      .mockRejectedValueOnce(new Error("download failed"))
      .mockResolvedValueOnce({ failedAgentIds: [] })
    const onProgress = vi.fn()

    const result = await runDistributionBatch(["a", "b", "c"], distribute, onProgress)

    expect(distribute.mock.calls.map(([id]) => id)).toEqual(["a", "b", "c"])
    expect(result.items.map((item) => item.status)).toEqual(["partial", "failed", "succeeded"])
    expect(result.succeededCount).toBe(1)
    expect(result.partialCount).toBe(1)
    expect(result.failedCount).toBe(1)
    expect(onProgress).toHaveBeenLastCalledWith({ completed: 3, total: 3, currentSkillId: null })
  })
})
```

- [x] **Step 2: Run the unit test and verify RED**

Run:

```bash
cd desktop-client && npm test -- src/__tests__/batch-distribution.test.ts
```

Expected: FAIL because `@/core/review/batch-distribution` does not exist.

- [x] **Step 3: Implement the pure controller**

Implement these public contracts without importing React or the IPC client:

```ts
import type {
  PendingSyncUpdate,
  PreDistributionCheckSnapshot,
  SkillDistributionResult
} from "@/types"

export type BatchEligibility = "eligible" | "installed" | "blocked"
export type BatchItemStatus = "succeeded" | "partial" | "failed"

export type BatchProgress = {
  completed: number
  total: number
  currentSkillId: string | null
}

export type BatchItemResult = {
  remoteSkillId: string
  status: BatchItemStatus
  result: SkillDistributionResult | null
  errorMessage: string | null
}

export type BatchDistributionSummary = {
  items: BatchItemResult[]
  succeededCount: number
  partialCount: number
  failedCount: number
}

export function getBatchEligibility(
  update: PendingSyncUpdate,
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean
): BatchEligibility {
  if (!snapshot || isStale || snapshot.globalErrors.length > 0 || snapshot.targetAgentIds.length === 0) {
    return "blocked"
  }

  const results = snapshot.results[update.remoteSkillId] ?? {}
  const targetResults = snapshot.targetAgentIds.map((agentId) => results[agentId])

  if (targetResults.some((result) => !result || result.contentComparison === "error")) {
    return "blocked"
  }

  return targetResults.every((result) => result?.contentComparison === "installed")
    ? "installed"
    : "eligible"
}

export function createDefaultBatchSelection(
  updates: PendingSyncUpdate[],
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean
): string[] {
  return updates
    .filter((update) => getBatchEligibility(update, snapshot, isStale) === "eligible")
    .map((update) => update.remoteSkillId)
}

export async function runDistributionBatch(
  remoteSkillIds: string[],
  distribute: (remoteSkillId: string) => Promise<SkillDistributionResult>,
  onProgress: (progress: BatchProgress) => void = () => undefined
): Promise<BatchDistributionSummary> {
  const items: BatchItemResult[] = []

  for (const [index, remoteSkillId] of remoteSkillIds.entries()) {
    onProgress({ completed: index, total: remoteSkillIds.length, currentSkillId: remoteSkillId })
    try {
      const result = await distribute(remoteSkillId)
      items.push({
        remoteSkillId,
        status: result.failedAgentIds.length > 0 ? "partial" : "succeeded",
        result,
        errorMessage: null
      })
    } catch (error: unknown) {
      items.push({
        remoteSkillId,
        status: "failed",
        result: null,
        errorMessage: error instanceof Error ? error.message : String(error)
      })
    }
  }

  onProgress({ completed: remoteSkillIds.length, total: remoteSkillIds.length, currentSkillId: null })
  return {
    items,
    succeededCount: items.filter((item) => item.status === "succeeded").length,
    partialCount: items.filter((item) => item.status === "partial").length,
    failedCount: items.filter((item) => item.status === "failed").length
  }
}
```

- [x] **Step 4: Run the unit test and verify GREEN**

Run the same focused test. Expected: PASS.

- [x] **Step 5: Commit the controller batch**

```bash
git add desktop-client/src/core/review/batch-distribution.ts desktop-client/src/__tests__/batch-distribution.test.ts
git commit -m "feat(desktop): add batch distribution controller"
```

## Task 2: Move Updates selection and batch orchestration into App

**Files:**

- Modify: `desktop-client/src/app/App.tsx`
- Modify: `desktop-client/src/__tests__/app.test.tsx`

- [x] **Step 1: Add failing integration tests for default selection, one confirmation, stable calls, navigation lock, and refresh-once**

Add a two-item fresh snapshot fixture and assert:

```ts
it("distributes all selected safe updates after one confirmation", async () => {
  mockDesktopClient.refreshSync
    .mockResolvedValueOnce(syncStateWith("skill-a", "skill-b"))
    .mockResolvedValueOnce(emptySyncState)
  mockDesktopClient.refreshPreDistributionCheck.mockResolvedValue(
    precheckWith({ "skill-a": "update", "skill-b": "not-installed" })
  )
  mockDesktopClient.distributePendingUpdate.mockResolvedValue(successfulDistributionResult)

  render(<App />)
  fireEvent.click(await screen.findByRole("button", { name: "Updates" }))

  expect(await screen.findByRole("checkbox", { name: "Select Skill A" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Select Skill B" })).toBeChecked()
  fireEvent.click(screen.getByRole("button", { name: "Distribute selected 2 items" }))
  fireEvent.click(screen.getByRole("button", { name: "Confirm distribution" }))

  await waitFor(() => {
    expect(mockDesktopClient.distributePendingUpdate.mock.calls).toEqual([["skill-a"], ["skill-b"]])
    expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(2)
  })
})
```

Add separate tests that an `error` item starts unchecked, a rejected first item does not prevent the second call, the progress copy appears, and Home/Local Skills/Projects navigation buttons are disabled during execution.

- [x] **Step 2: Run the focused App tests and verify RED**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "selected safe updates|rejected batch item|batch navigation"
```

Expected: FAIL because the current UI has no batch selection or batch action.

- [x] **Step 3: Add orchestration state and refresh-driven default selection**

Replace the single pending confirmation state with:

```ts
const [selectedUpdateIds, setSelectedUpdateIds] = useState<string[]>([])
const [pendingDistributionConfirmation, setPendingDistributionConfirmation] =
  useState<PendingSyncUpdate[] | null>(null)
const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
const [batchResults, setBatchResults] = useState<BatchDistributionSummary | null>(null)
```

Recompute selection only when the pending fingerprint or accepted precheck snapshot changes:

```ts
useEffect(() => {
  setSelectedUpdateIds(
    createDefaultBatchSelection(
      syncState.pendingUpdates,
      preDistributionCheckSnapshot,
      isPreDistributionCheckStale
    )
  )
}, [pendingUpdateFingerprint, preDistributionCheckSnapshot, isPreDistributionCheckStale])
```

Add callbacks for one toggle, all eligible, and clear. Preserve pending-update order when producing the selected list.

- [x] **Step 4: Refactor execution to run all items, record per-item activity, then refresh once**

Use `runDistributionBatch` with `desktopClient.distributePendingUpdate`. Do not call the existing refresh-bearing `executeDistribution` inside the loop. After the runner finishes:

```ts
const refreshedState = await desktopClient.refreshSync()
setSyncState(refreshedState)
await refreshPreDistributionCheckForState(refreshedState)
setBatchResults(summary)
```

For each `summary.items`, append the existing success/warning/failure activity entry using the matched `PendingSyncUpdate`. Add one localized batch summary entry. If the final refresh fails, preserve the completed batch summary and show the existing refresh-warning pattern.

- [x] **Step 5: Lock conflicting top-level operations during execution**

Derive `isBatchDistributing = batchProgress?.currentSkillId !== null`. Pass it into `AppShell`; disable refresh, navigation, selection, Settings, theme changes, and reconcile actions while true. Do not disable window close or Electron lifecycle behavior.

- [x] **Step 6: Run the focused App tests and verify GREEN**

Run the tests from Step 2. Expected: PASS.

- [x] **Step 7: Commit App orchestration**

```bash
git add desktop-client/src/app/App.tsx desktop-client/src/__tests__/app.test.tsx
git commit -m "feat(desktop): orchestrate selected update distribution"
```

## Task 3: Build the Updates review workspace

**Files:**

- Create: `desktop-client/src/components/updates-review-workspace.tsx`
- Create: `desktop-client/src/components/review-summary.tsx`
- Create: `desktop-client/src/components/review-action-bar.tsx`
- Modify: `desktop-client/src/components/updates-view.tsx`
- Retire after callers are migrated: `desktop-client/src/components/pending-updates-panel.tsx`
- Modify: `desktop-client/src/i18n/messages/types.ts`
- Modify: `desktop-client/src/i18n/messages/en-US.ts`
- Modify: `desktop-client/src/i18n/messages/zh-CN.ts`
- Modify: `desktop-client/src/__tests__/app.test.tsx`

- [x] **Step 1: Write failing semantic UI tests**

Cover five-column table headers, checkbox labels, blocked reason text, selected count, target count, `Select all distributable`, `Clear selection`, Updates-only sticky bar, and card-equivalent data in the DOM.

```ts
expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument()
expect(screen.getByRole("columnheader", { name: "Change" })).toBeInTheDocument()
expect(screen.getByRole("checkbox", { name: "Select Skill A" })).toBeChecked()
expect(screen.getByText("1 item blocked by target checks")).toBeInTheDocument()
expect(screen.getByRole("button", { name: "Clear selection" })).toBeInTheDocument()
expect(screen.getByTestId("review-action-bar")).toHaveTextContent("2 selected")
```

- [x] **Step 2: Run the targeted renderer tests and verify RED**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "review workspace|selection controls|blocked target"
```

Expected: FAIL on missing table, selection controls, and summary.

- [x] **Step 3: Add typed localized copy**

Add a `reviewWorkspace` dictionary section with the same shape in all three files:

```ts
reviewWorkspace: {
  steps: string
  connected: string
  selected: (count: number) => string
  blocked: (count: number) => string
  writeTargets: (count: number) => string
  selectItem: (name: string) => string
  selectAll: string
  clearSelection: string
  distributeSelected: (count: number) => string
  distributing: (completed: number, total: number) => string
  columns: { select: string; status: string; change: string; targets: string; version: string }
  statuses: { ready: string; blocked: string; installed: string }
  blockedReason: string
  summaryTitle: string
  confirmationTitle: (count: number) => string
  batchCompleted: (succeeded: number, partial: number, failed: number) => string
}
```

English and Chinese values must be natural, not literal token substitutions. Reuse `common` strings only when the meaning is identical.

- [x] **Step 4: Implement focused components**

`ReviewSummary` receives counts and last-check text only. `ReviewActionBar` receives selection/progress values and callbacks only. `UpdatesReviewWorkspace` receives pending rows, eligibility lookup, selection state, and existing reconcile/precheck callbacks. It must render one semantic table plus CSS-driven card labels rather than duplicate interactive controls for desktop and mobile.

Core props:

```ts
type UpdatesReviewWorkspaceProps = {
  pendingUpdates: PendingSyncUpdate[]
  snapshot: PreDistributionCheckSnapshot | null
  isChecking: boolean
  isStale: boolean
  selectedUpdateIds: string[]
  busyUpdateId: string | null
  batchProgress: BatchProgress | null
  onToggleSelected: (remoteSkillId: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onRequestDistribution: () => void
  onReconcileInstalled: (update: PendingSyncUpdate) => void
  onRefreshCheck: () => void
}
```

Render blocked items with a text reason and unchecked disabled checkbox. Render installed items with the existing reconcile action. Only eligible items can enter the selection.

- [x] **Step 5: Replace `PendingUpdatesPanel` in `UpdatesView`**

Keep `PageIntro`, warning callouts, empty/loading states, and refresh-check behavior. Delete `pending-updates-panel.tsx` only after no imports remain:

```bash
rg -n "PendingUpdatesPanel|pending-updates-panel" desktop-client/src
```

Expected before deletion: no matches outside the file being removed.

- [x] **Step 6: Run tests and verify GREEN**

Run the targeted tests, then:

```bash
cd desktop-client && npm test -- src/__tests__/batch-distribution.test.ts src/__tests__/app.test.tsx
```

Expected: PASS.

- [x] **Step 7: Commit the Updates workspace**

```bash
git add desktop-client/src/components desktop-client/src/i18n/messages desktop-client/src/__tests__/app.test.tsx
git commit -m "feat(desktop): build responsive updates review workspace"
```

## Task 4: Replace the top header with the shared responsive sidebar Shell

**Files:**

- Modify: `desktop-client/src/components/app-shell.tsx`
- Modify: `desktop-client/src/styles.css`
- Modify: `desktop-client/src/i18n/messages/types.ts`
- Modify: `desktop-client/src/i18n/messages/en-US.ts`
- Modify: `desktop-client/src/i18n/messages/zh-CN.ts`
- Modify: `desktop-client/src/__tests__/app.test.tsx`

- [x] **Step 1: Write failing Shell tests**

Assert one navigation landmark, four links/buttons with current-page state, visible connection status, Settings/theme/refresh controls, and disabled navigation during a batch:

```ts
const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })
expect(within(navigation).getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page")
expect(screen.getByText("Connected")).toBeInTheDocument()
expect(screen.getByRole("button", { name: "Updates" })).toBeDisabled()
```

- [x] **Step 2: Run Shell-focused tests and verify RED**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "sidebar shell|batch navigation"
```

Expected: FAIL because current navigation is in a two-row top header and has no `aria-current` or execution lock.

- [x] **Step 3: Implement the Shell structure**

Use lucide icons already in dependencies (`House`, `RefreshCw`, `FolderOpen`, `PanelsTopLeft`, `Settings`). Preserve visible labels in normal sidebar mode and accessible names in compact mode. The DOM skeleton must remain single-source across breakpoints:

```tsx
<main className="app-shell">
  <aside className="app-sidebar">
    <div className="brand">...</div>
    <nav className="app-nav" aria-label={dictionary.appShell.desktopClientLabel}>...</nav>
    <div className="app-sidebar__footer">...</div>
  </aside>
  <div className="app-workspace">
    <header className="workspace-toolbar">...</header>
    <div className="app-main">{children}</div>
  </div>
</main>
```

Add `navigationLocked: boolean` to `AppShellProps`; every navigation/global-action handler is disabled while locked.

- [x] **Step 4: Add the three responsive Shell breakpoints**

Use CSS grid with these explicit rules:

```css
.app-shell { display:grid; grid-template-columns:13.5rem minmax(0,1fr); min-height:100vh; }
.app-main { width:min(100%, 96rem); margin:0 auto; padding:1.25rem 1.5rem 6.5rem; }

@media (min-width:1440px) { .app-main { padding-inline:2rem; } }
@media (max-width:1099px) {
  .app-shell { grid-template-columns:4.5rem minmax(0,1fr); }
  .app-nav .btn__label, .brand__copy, .app-sidebar__footer-copy { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
}
```

Do not use viewport-wide fixed overlays over the sidebar. Keep the existing dark/light semantic tokens.

- [x] **Step 5: Run Shell tests and verify GREEN**

Run the test from Step 2. Expected: PASS.

- [x] **Step 6: Commit the shared Shell**

```bash
git add desktop-client/src/components/app-shell.tsx desktop-client/src/styles.css desktop-client/src/i18n/messages desktop-client/src/__tests__/app.test.tsx
git commit -m "feat(desktop): add responsive sidebar shell"
```

## Task 5: Make Home a read-only review summary

**Files:**

- Modify: `desktop-client/src/components/home-view.tsx`
- Modify: `desktop-client/src/app/App.tsx`
- Modify: `desktop-client/src/styles.css`
- Modify: `desktop-client/src/__tests__/app.test.tsx`

- [x] **Step 1: Write a failing Home behavior test**

```ts
it("routes review work from Home to Updates", async () => {
  render(<App />)
  expect(await screen.findByText("Skill A")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Distribute Skill A" })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "View all updates" }))
  expect(screen.getByRole("heading", { name: "All pending updates" })).toBeInTheDocument()
})
```

Also retain assertions for four metrics, bridge/configuration warnings, three-item maximum, and Settings guidance.

- [x] **Step 2: Run Home-focused tests and verify RED**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "routes review work from Home|Home"
```

Expected: the new no-distribute assertion fails against current Home.

- [x] **Step 3: Remove direct distribution/reconcile props from Home**

Remove `busyUpdateId`, `onDistribute`, `onReconcileInstalled`, and detailed precheck action controls from `HomeViewProps`. Keep compact status badges and the `onViewUpdates` CTA. Update `App.tsx` call sites accordingly.

- [x] **Step 4: Apply the responsive Home layout**

Keep a metric grid and a review-preview panel. At `>= 1440px`, use two columns; below `1100px`, use one column. Do not add Home-only persisted state.

- [x] **Step 5: Run Home tests and verify GREEN**

Run the focused tests. Expected: PASS.

- [x] **Step 6: Commit Home migration**

```bash
git add desktop-client/src/components/home-view.tsx desktop-client/src/app/App.tsx desktop-client/src/styles.css desktop-client/src/__tests__/app.test.tsx
git commit -m "feat(desktop): focus Home on review summary"
```

## Task 6: Add responsive Local Skills contextual detail

**Files:**

- Modify: `desktop-client/src/components/local-skills-view.tsx`
- Modify: `desktop-client/src/styles.css`
- Modify: `desktop-client/src/i18n/messages/types.ts`
- Modify: `desktop-client/src/i18n/messages/en-US.ts`
- Modify: `desktop-client/src/i18n/messages/zh-CN.ts`
- Modify: `desktop-client/src/__tests__/app.test.tsx`

- [x] **Step 1: Write failing detail-selection tests**

Assert that selecting a grouped row exposes name, full path, source Agents, version, server state, and the same upload/open/delete actions without bypassing existing dialogs. Assert Enter and Space select the same row.

```ts
fireEvent.click(await screen.findByRole("button", { name: "Inspect frontend-design" }))
const detail = screen.getByRole("complementary", { name: "frontend-design details" })
expect(within(detail).getByText("D:\\skills\\frontend-design")).toBeInTheDocument()
expect(within(detail).getByText(/Codex/)).toBeInTheDocument()
```

- [x] **Step 2: Run Local Skills tests and verify RED**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "Local Skills detail|grouped local skill"
```

Expected: FAIL because no persistent contextual detail region exists.

- [x] **Step 3: Add selected-group state without replacing path-picker semantics**

Add `selectedGroupKey` and derive `selectedGroup`. Row selection opens detail; the explicit open-folder control retains the current direct-open/single-path and radio-dialog/multi-path behavior. Avoid a clickable `<article role="button">` containing nested buttons; use a real `Inspect` button or separate non-nested row action.

- [x] **Step 4: Render and style contextual detail**

Render one `<aside aria-label={copy.detailLabel(name)}>` as the second grid item. At wide widths it occupies the contextual-detail column; below `1100px` the same element flows immediately beneath the inventory list as an inline detail card. Do not duplicate the content or action callbacks. Add localized `inspect`, `detailLabel`, `usedBy`, and `paths` copy.

- [x] **Step 5: Re-run existing destructive and multi-path regressions**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "Local Skills|delete|path"
```

Expected: PASS, including type-to-confirm delete and path picker tests.

- [x] **Step 6: Commit Local Skills migration**

```bash
git add desktop-client/src/components/local-skills-view.tsx desktop-client/src/styles.css desktop-client/src/i18n/messages desktop-client/src/__tests__/app.test.tsx
git commit -m "feat(desktop): add responsive local skill details"
```

## Task 7: Convert Projects to responsive master-detail

**Files:**

- Modify: `desktop-client/src/components/projects-view.tsx`
- Modify: `desktop-client/src/styles.css`
- Modify: `desktop-client/src/__tests__/app.test.tsx`

- [x] **Step 1: Write failing master-detail tests**

At the DOM level, assert that selecting a project keeps the project list available and renders project Skill details in a labelled region. Preserve add/rename/remove/import dialog assertions.

```ts
fireEvent.click(await screen.findByRole("button", { name: "Open SkillDrive" }))
expect(screen.getByRole("navigation", { name: "Projects" })).toBeInTheDocument()
expect(screen.getByRole("region", { name: "SkillDrive skills" })).toBeInTheDocument()
expect(screen.getByRole("button", { name: "Import Skill" })).toBeInTheDocument()
```

- [x] **Step 2: Run Projects tests and verify RED**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "Projects master detail|project operations"
```

Expected: FAIL because the selected-project branch replaces the list.

- [x] **Step 3: Remove the early-return split and compose list plus detail**

Extract `renderProjectList()` and `renderProjectDetail(selectedProject)` local render helpers or focused child components in the same file. The wide DOM includes both; CSS controls narrow presentation. Keep `selectedProjectId` owned by `App.tsx` and preserve current refresh/import callbacks.

- [x] **Step 4: Add narrow list/detail navigation semantics**

Below `1100px`, selecting a project hides the visual list and reveals detail with a Back button; the list may remain mounted only if hidden content is also removed from tab order. Above the breakpoint, hide the Back button and show both columns.

- [x] **Step 5: Re-run all Project operation tests**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx -t "Project"
```

Expected: PASS for add, rename, remove, folder open, refresh, validation, and import.

- [x] **Step 6: Commit Projects migration**

```bash
git add desktop-client/src/components/projects-view.tsx desktop-client/src/styles.css desktop-client/src/__tests__/app.test.tsx
git commit -m "feat(desktop): add responsive project master detail"
```

## Task 8: Complete responsive, accessibility, and reduced-motion CSS

**Files:**

- Modify: `desktop-client/src/styles.css`
- Modify: `desktop-client/src/__tests__/app.test.tsx`

- [x] **Step 1: Add structural accessibility assertions**

Cover unique landmarks, no nested interactive controls, `aria-current`, visible textual blocked status, progress `role="status"`, and action-bar presence only on Updates with a non-empty selection.

- [x] **Step 2: Run all renderer tests and fix regressions without weakening assertions**

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx
```

Expected: PASS.

- [x] **Step 3: Finish the three breakpoint layouts**

Use exactly one media-query source for each threshold:

```css
@media (min-width:1440px) { /* wide right rail and page detail columns */ }
@media (min-width:1100px) and (max-width:1439px) { /* summary strip and conditional detail */ }
@media (max-width:1099px) { /* compact nav, cards, single-column page layouts */ }
@media (prefers-reduced-motion:reduce) { *, *::before, *::after { scroll-behavior:auto !important; transition-duration:.01ms !important; animation-duration:.01ms !important; animation-iteration-count:1 !important; } }
```

Ensure `.app-main` reserves at least the action bar height only when the bar is rendered. Use content-area `position: sticky; bottom: 0` or a content-column fixed inset; never cover the sidebar.

- [x] **Step 4: Run full desktop tests and typecheck**

```bash
cd desktop-client && npm test
cd desktop-client && npm run typecheck:electron
```

Expected: all tests PASS and TypeScript exits 0.

- [x] **Step 5: Commit responsive/accessibility completion**

```bash
git add desktop-client/src/styles.css desktop-client/src/__tests__/app.test.tsx
git commit -m "fix(desktop): complete responsive review accessibility"
```

## Task 9: Update durable docs and run completion gates

**Files:**

- Modify: `desktop-client/docs/DESIGN.md`
- Modify: `desktop-client/docs/ARCHITECTURE.md`
- Modify: `desktop-client/task-tracker.md`
- Modify during execution: `desktop-client/docs/exec-plans/active/2026-08-27-responsive-review-workspace.md`
- Move on completion: `desktop-client/docs/exec-plans/active/2026-08-27-responsive-review-workspace.md` to `desktop-client/docs/exec-plans/completed/2026-08-27-responsive-review-workspace.md`
- Modify: `desktop-client/docs/exec-plans/active/index.md`
- Modify: `desktop-client/docs/exec-plans/completed/index.md`

- [x] **Step 1: Update durable design and architecture truth**

Document the implemented Shell breakpoints, Updates-only action bar, Home read-only preview, Local Skills detail behavior, Projects master-detail behavior, and Renderer-only batch boundary. Do not describe planned behavior as implemented until its tests and build pass.

- [x] **Step 2: Run the production build**

```bash
cd desktop-client && npm run build
```

Expected: Electron typecheck and all Vite builds exit 0.

- [x] **Step 3: Perform visual verification at the three CSS widths**

Use the same populated state when possible and inspect Home, Updates, Local Skills, and Projects at:

- `>= 1440px`: sidebar plus page-specific wide columns.
- `1100px–1439px`: Updates summary strip and no clipped five-column content.
- `< 1100px`: compact navigation, Updates cards, single-column page layouts.

Record any state that cannot be exercised and its residual risk in this plan. Capture screenshots for internal comparison; do not claim visual verification from DOM tests alone.

Completion evidence: a read-only browser check exercised the shared shell and all four routes at `1280x720` (medium band); the sidebar/content split had no horizontal overflow. The browser session used for this check could not override the viewport, so the `>= 1440px` and `< 1100px` bands were not directly screenshot-verified. The check used the bridge-unavailable/empty-data state rather than populated review data. DOM/accessibility assertions, CSS inspection, and the production build cover structure, but manual visual fit for the two unverified width bands and populated data remains residual QA risk.

- [x] **Step 4: Run repository hard gates**

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Expected: 0 documentation errors and no whitespace errors.

- [x] **Step 5: Update plan Progress, Decisions, validation evidence, and task tracker**

Record exact commands and outcomes. Add genuine follow-up debt to `desktop-client/docs/exec-plans/tech-debt-tracker.md`; do not create speculative debt.

- [x] **Step 6: Archive the completed plan and update indexes**

Move this file only after all required gates pass and no required work remains. Update active/completed indexes in the same commit.

- [x] **Step 7: Commit documentation and completion evidence**

```bash
git add desktop-client/docs desktop-client/task-tracker.md
git commit -m "docs(desktop): complete responsive review workspace"
```

## Validation matrix

| Area | Command | Required outcome |
|------|---------|------------------|
| Batch controller | `cd desktop-client && npm test -- src/__tests__/batch-distribution.test.ts` | Eligibility, ordering, continuation, progress, aggregation pass |
| Renderer integration | `cd desktop-client && npm test -- src/__tests__/app.test.tsx` | Shell and four page flows pass |
| Desktop regression | `cd desktop-client && npm test` | Entire desktop suite passes |
| Electron types | `cd desktop-client && npm run typecheck:electron` | Exit 0 |
| Production build | `cd desktop-client && npm run build` | Exit 0 |
| Documentation | `python scripts/validate_agents_docs.py --level ERROR` | 0 errors |
| Diff hygiene | `git diff --check` | No output |
| Visual QA | Three CSS-width bands across four pages | No clipped, obscured, or unreachable essential controls |

## Risks and mitigations

- **Selection resets unexpectedly:** recompute only after review/precheck identity changes, not after every render.
- **Stale precheck becomes selectable:** centralize eligibility in the pure controller and pass the same result to table, summary, and action bar.
- **Partial result is mistaken for success:** preserve `partial` separately from resolved success and rejected failure.
- **Action bar hides content:** scope it to `.app-workspace` and reserve bottom padding only when present.
- **Nested interactive controls regress Local Skills/Projects accessibility:** replace clickable article containers with explicit inspect/open buttons.
- **Four-page change becomes difficult to review:** keep the commit sequence aligned with Tasks 1–9 and run focused tests after every batch.

## Progress

- [x] 2026-08-27: Product spec and visual direction approved.
- [x] 2026-08-27: Execution plan approved and implementation completed in the isolated worktree.
- [x] Task 1: Batch controller (`ed0dcb2`).
- [x] Task 2: App orchestration and execution locks (`c5838ad`, `6c1cdc1`, `9923a4c`, `856cc6a`, `1349bff`, `1914433`).
- [x] Task 3: Updates workspace (`dd1bdec`, `3b8211d`).
- [x] Task 4: Shared Shell (`ef54cf1`).
- [x] Task 5: Home (`57e25e4`).
- [x] Task 6: Local Skills (`c360066`).
- [x] Task 7: Projects (`77a117f`).
- [x] Task 8: Responsive/accessibility completion (`05c2d11`).
- [x] Task 9: Durable documentation, plan archival, and completion gates (this commit).

## Completion evidence

- `cd desktop-client && npm test`: PASS, 38 files and 227 tests.
- `cd desktop-client && npm run typecheck:electron`: PASS.
- `cd desktop-client && npm run build`: PASS.
- `git diff --check`: PASS with no output.
- Visual check: `1280x720` medium-band read-only browser inspection covered all four routes without horizontal overflow; direct screenshot verification of the wide and compact bands, and populated review data, was unavailable in the current browser session. See Task 9 Step 3 for the residual risk.
- No backend, IPC channel, database, adapter, or persistence changes were made for this workspace.

## Plan self-review checklist

- [x] Every product-spec acceptance criterion maps to at least one task.
- [x] No backend, IPC, database, adapter, or persistence work is implied.
- [x] Public types and names are consistent across Tasks 1–3.
- [x] Home, Updates, Local Skills, and Projects each have focused tests and a commit boundary.
- [x] Full desktop, build, docs, diff, and visual gates are named.
- [x] No incomplete work marker remains in the plan.
