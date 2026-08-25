# Local Skill Delete Confirmation Dialog

## Background

The Local Skills view in the desktop client allows users to delete skill files from disk. When skills with the same name exist in multiple paths (e.g., `~/.agents/skills/` and `~/.claude/skills/`), the grouped row delete operation removes ALL copies across all paths simultaneously. Currently, the delete action fires immediately without any confirmation, risking accidental data loss.

## Goals

1. Show a confirmation dialog when the user clicks delete on ANY skill row (single or grouped).
2. Display the skill name, full paths, and agent ownership for each path entry.
3. Require a destructive confirm action (typing the skill name) before enabling the Delete button.
4. Clearly communicate that files will be permanently removed from disk.
5. Provide Cancel and Delete action buttons.

## Non-Goals (Out of Scope)

- Changing the delete logic itself (batch deletion of group copies remains unchanged).
- Adding undo functionality after deletion.
- Cleaning up remote server records during deletion (existing behavior preserved).
- Adding a "do not show again" option or keyboard shortcut for skip-confirmation.
- Modifying the project-level skill delete flow (this is only for Local Skills view).

## Functional Requirements

- **FR-1**: When user clicks the delete button on ANY skill row, a confirmation dialog appears before performing the delete.
- **FR-2**: The dialog displays the skill name being deleted and the total path count.
- **FR-3**: The dialog lists ALL paths with full `packageRootPath`, showing agent ownership (`sourceDisplayNames`) for each entry.
- **FR-4**: The dialog shows a warning that files will be permanently removed from disk and this cannot be undone.
- **FR-5**: The dialog includes a destructive confirmation: user must type the skill name into a text field before the Delete button becomes enabled.
- **FR-6**: The Delete button is disabled until the user correctly types the exact skill name.
- **FR-7**: Clicking "Cancel", the overlay, or pressing Escape closes the dialog without performing any delete.
- **FR-8**: Clicking "Delete" (when enabled) closes the dialog and performs the existing delete logic.
- **FR-9**: The dialog supports both single-path rows (pathCount === 1) and grouped rows (pathCount > 1).
- **FR-10**: The dialog is not shown when the skill row is already in a deleting state.

## Non-Functional Requirements

- The dialog must use the existing `Dialog` component from `ui-primitives.tsx`.
- All user-facing text must be internationalized (i18n) with keys in both en-US and zh-CN.
- The dialog must be accessible (role="dialog", aria-modal, keyboard navigation).
- Existing tests must continue to pass (36 test files, 190 tests).

## Constraints

- Only modify `desktop-client/`范围内的代码.
- Must use the existing `Dialog` component in `ui-primitives.tsx`.
- Must follow existing i18n patterns.
- Must not change the delete behavior itself.

## Acceptance Criteria

- [ ] Dialog appears on delete click for ALL rows (single and grouped).
- [ ] Dialog shows full paths (not condensed) with agent ownership for each entry.
- [ ] Dialog shows warning about permanent file deletion.
- [ ] Delete button is disabled until user types exact skill name.
- [ ] Cancel closes dialog without triggering delete.
- [ ] Delete triggers the existing delete logic with correct groupRowKeys.
- [ ] All existing tests pass.
- [ ] Build succeeds.
