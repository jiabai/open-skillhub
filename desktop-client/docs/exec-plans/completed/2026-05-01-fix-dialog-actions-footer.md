# Fix Dialog Actions Footer Exec Plan

## Goal

Fix the confirmation dialog layout so that the "Cancel" and "Confirm" action buttons are properly visible and fixed at the bottom of the dialog instead of being lost in the scrollable body content.

## Scope

- Analyze current `Dialog` component structure in `ui-primitives.tsx`
- Add a dedicated footer slot for dialog action buttons
- Ensure dialog body content scrolls properly while footer stays fixed
- Update the confirmation dialog usage in `App.tsx`
- Keep the fix scoped to `Dialog`; `Drawer` already has its own full-height column layout and is not affected by this bug
- Update documentation if needed

## Non-Goals

- No changes to dialog content, title, or overlay behavior
- No changes to button styling or functionality
- No changes to i18n strings
- No structural changes to dialog open/close logic

## Implementation Steps

1. **Analyze current structure**: Review `ui-primitives.tsx`'s `Dialog` component and `styles.css`'s dialog-related classes
2. **Add regression coverage**: Verify the distribution confirmation actions render in a dedicated dialog footer outside the scrollable body
3. **Update Dialog component**: Add an optional `footer` property to the `Dialog` component type
4. **Adjust CSS layout**: Modify `styles.css` so the dialog uses header/body/footer rows, the body can scroll, and the footer remains visible at the bottom
5. **Update usage**: Modify `App.tsx`'s distribution confirmation dialog to use the new footer slot
6. **Test validation**: Run tests, build, and docs validation

## Progress

- [x] Analyze current structure completed
- [x] Regression coverage added
- [x] Dialog component updated with footer slot
- [x] CSS layout adjusted for proper footer positioning
- [x] Confirmation dialog usage updated
- [x] Tests and validation gates passed

## Validation Results

- `npm test -- src/__tests__/app.test.tsx -t "renders distribution confirmation actions in the dialog footer"` passed after first failing on the old body-contained action layout.
- `npm test -- src/__tests__/app.test.tsx` passed with 15 tests.
- `npm run typecheck:electron` passed.
- `npm test` passed with 74 tests.
- `npm run build` passed.
- `python scripts/validate_agents_docs.py --level ERROR` passed.

## Decisions

- Use a dedicated footer prop/slot instead of relying on children positioning for better component contract clarity
- Keep the existing `children` for body content only
- Ensure backward compatibility: existing uses without footer should continue working
- Follow the existing pattern in the codebase for component API design
- Do not change `Drawer`; it already uses a column layout with a scrollable body and has no reported footer action loss

## Validation Plan

- `cd desktop-client && npm test`
- `cd desktop-client && npm run build`
- `python scripts/validate_agents_docs.py --level ERROR`

## Notes

- The issue affects only the renderer UI layer, no changes to IPC or core services
- This is a bug fix for a UI/layout issue, not a feature
- No architecture changes beyond the UI primitives layer
- Root cause: the confirmation actions are currently rendered inside `.dialog-panel__body`, so they participate in the scrollable content instead of occupying a stable footer row

## Outcome

- Completed on 2026-05-01. The distribution confirmation dialog now renders action buttons in a dedicated footer outside the scrollable body, keeping Cancel and Confirm visible at the bottom while long target lists scroll independently.
