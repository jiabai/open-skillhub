# Product Spec: Local Skill Group Path Picker

- Date: 2026-08-26
- Status: Approved for planning
- Related: `2026-05-01-local-skills-management.md`, `2026-08-25-local-skill-grouping`

## User-Visible Goal

When the Local Skills view aggregates multiple local directories with the same
SKILL name into one card, clicking that card must not guess which directory to
open. The user chooses the exact local path in a compact dialog.

## Scope

- Keep the current direct-open behavior for groups with one path.
- For groups with more than one path, open a narrow path-selection dialog.
- List every path in the group with its contributing agent/source names.
- Select the first path by default, allow changing the selection, and open only
  the selected path after the user confirms.
- Close the dialog without opening a path when the user cancels, presses Escape,
  clicks the close button, or clicks the overlay.
- Add English and Simplified Chinese labels and preserve keyboard accessibility.

## Non-Goals

- No changes to local-skill grouping, row ordering, upload/delete behavior, IPC,
  backend APIs, or filesystem path resolution.
- No automatic preference persistence for a selected path.
- No new path picker for single-path groups or other views.

## Affected Surfaces

- `desktop-client/src/components/local-skills-view.tsx` — group click behavior,
  selection state, and dialog rendering.
- `desktop-client/src/i18n/messages/en-US.ts` and `zh-CN.ts` — dialog labels.
- `desktop-client/src/i18n/messages/types.ts` — dictionary contract.
- `desktop-client/src/__tests__/app.test.tsx` — single/multi-path interaction
  regression coverage.
- `desktop-client/task-tracker.md` — completion record.

## Acceptance Criteria

1. Clicking a single-path group calls `onOpenFolder` immediately with its only
   row and does not render a path-picker dialog.
2. Clicking a multi-path group renders a narrow dialog and does not call
   `onOpenFolder` before confirmation.
3. The dialog lists all group paths, defaults to the first row, and exposes
   accessible single-choice controls.
4. Selecting a non-primary path and confirming calls `onOpenFolder` exactly once
   with that selected row, then closes the dialog.
5. Cancel, close, Escape, and overlay dismissal close the dialog without opening
   any path.
6. Existing upload/delete controls continue to stop card-click propagation.
7. Existing desktop tests, Electron typecheck, production build, documentation
   validation, and diff checks pass.
