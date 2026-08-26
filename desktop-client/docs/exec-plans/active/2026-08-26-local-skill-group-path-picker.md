# Local Skill Group Path Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a grouped Local Skills card ask the user which local directory to open whenever the group contains multiple same-name paths.

**Architecture:** Keep path selection entirely in the renderer. `LocalSkillsView` will retain the existing `onOpenFolder(row)` callback, add transient dialog/selection state, and pass the selected row to that callback only after confirmation. Single-path groups continue to bypass the dialog.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing `Dialog`/`Button` primitives, typed i18n dictionaries.

---

### Task 1: Add the multi-path interaction regression tests

**Files:**
- Modify: `desktop-client/src/__tests__/app.test.tsx` near the existing Local Skills tests

- [ ] **Step 1: Add a multi-path snapshot fixture and test the dialog opening**

Use two valid rows in one `groupedRows` entry, with distinct `rowKey` and
`packageRootPath` values. Navigate to Local Skills, click the group article (not
an action button), assert a `role="dialog"` with the path-picker title is shown,
assert both path strings are present, and assert
`mockDesktopClient.openLocalSkillFolder` has not been called.

- [ ] **Step 2: Extend the test to select the second path and confirm**

Click the radio control associated with the second row, click the dialog's
localized `Open path` button, then assert the bridge was called once with the
second row key and the dialog is gone.

- [ ] **Step 3: Add cancellation and single-path coverage**

Add one test that opens a multi-path dialog and clicks `Cancel`, then verifies no
folder bridge call. Add one test that clicks a single-path group and verifies the
primary row opens immediately without rendering a dialog.

- [ ] **Step 4: Run the focused tests and verify the expected RED state**

Run:

```text
npm.cmd exec vitest run src/__tests__/app.test.tsx
```

Expected before implementation: the new dialog assertions fail because the
current group click handler directly calls `onOpenFolder(group.primary)`.

### Task 2: Add localized path-picker copy

**Files:**
- Modify: `desktop-client/src/i18n/messages/types.ts:106-143`
- Modify: `desktop-client/src/i18n/messages/en-US.ts:109-146`
- Modify: `desktop-client/src/i18n/messages/zh-CN.ts:107-144`

- [ ] **Step 1: Extend the dictionary contract**

Add these fields to `localSkillsView`:

```ts
openPathDialogTitle: string
openPathDialogDescription: (name: string, count: number) => string
openPathDialogPathLabel: (path: string) => string
openPathDialogPathAgents: (agents: string) => string
openPathDialogConfirm: string
```

- [ ] **Step 2: Provide matching English and Simplified Chinese values**

Use concise copy equivalent to “Choose local path”, “Select which local path to
open for {name}”, “Open path”, and “Used by: {agents}”. Keep `Cancel` and
`Close` from `dictionary.common`.

- [ ] **Step 3: Run the focused tests for dictionary/type feedback**

Run:

```text
npm.cmd exec vitest run src/__tests__/app.test.tsx
```

Expected: tests still fail only on missing path-picker behavior, not on missing
dictionary keys or TypeScript transform errors.

### Task 3: Implement transient renderer path selection

**Files:**
- Modify: `desktop-client/src/components/local-skills-view.tsx:1-306`

- [ ] **Step 1: Add state for the pending group and selected row**

Add:

```ts
const [pendingOpenGroup, setPendingOpenGroup] = useState<LocalSkillGroupRow | null>(null)
const [selectedOpenRowKey, setSelectedOpenRowKey] = useState<string | null>(null)
```

When a multi-path group is clicked, set the group and initialize the selection
to `group.items[0]?.rowKey ?? null`. When closing, clear both values.

- [ ] **Step 2: Branch group opening by path count**

Replace the current `handleGroupOpen` body with this behavior:

```ts
const handleGroupOpen = () => {
  if (group.pathCount <= 1) {
    onOpenFolder(group.primary)
    return
  }

  setPendingOpenGroup(group)
  setSelectedOpenRowKey(group.items[0]?.rowKey ?? null)
}
```

Keep the existing `stopPropagation()` handling on upload and delete buttons.

- [ ] **Step 3: Render a narrow dialog for multi-path groups**

Render the dialog after the existing delete dialog. Its body should map
`pendingOpenGroup.items` to labels containing a controlled radio input, the full
`packageRootPath`, and source-agent text. Use a stable radio group name, default
the first item through state, and make each label keyboard selectable. The
confirm handler finds the selected row, calls `onOpenFolder(selectedRow)` once,
then clears the dialog state. If no row is selected, the confirm button is
disabled. Cancel/close/Escape/overlay all use the same clear handler.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```text
npm.cmd exec vitest run src/__tests__/app.test.tsx
```

Expected: all App tests pass, including the new single-path, multi-path,
selection, and cancellation cases.

### Task 4: Validate and close the plan

**Files:**
- Modify: `desktop-client/task-tracker.md`
- Modify: `desktop-client/docs/product-specs/2026-08-26-local-skill-group-path-picker.md`

- [ ] **Step 1: Run the complete desktop validation gates**

Run from `desktop-client`:

```text
npm.cmd test
npm.cmd run typecheck:electron
npm.cmd run build
```

Run from the repository root:

```text
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

- [ ] **Step 2: Record the completed behavior**

Add a checked entry to `desktop-client/task-tracker.md` and a short follow-up
note to the product spec describing the single-path direct-open and multi-path
confirmation behavior.

- [ ] **Step 3: Move the completed plan**

After all gates pass, move this plan to
`desktop-client/docs/exec-plans/completed/2026-08-26-local-skill-group-path-picker.md`
and add it to the completed index. Remove it from the active index so no stale
active plan remains.
