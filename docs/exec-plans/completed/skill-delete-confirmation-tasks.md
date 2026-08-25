# Skill Delete Confirmation — Task Checklist

## [x] Task 1: Add i18n keys for delete confirmation dialog
- **Priority**: high
- **Depends On**: None
- **Description**: Add 8 new i18n keys to `localSkillsView` section in types.ts, en-US.ts, and zh-CN.ts.
- **Validation**:
  - [x] TR-1.1: All 8 new keys exist in types.ts with correct type signatures
  - [x] TR-1.2: Translations exist in both en-US.ts and zh-CN.ts
  - [x] TR-1.3: TypeScript type-check passes for message files

## [x] Task 2: Add delete confirmation dialog to local-skills-view.tsx
- **Priority**: high
- **Depends On**: Task 1
- **Description**: Add Dialog with destructive confirm, full paths, and agent ownership display.
- **Validation**:
  - [x] TR-2.1: Clicking delete opens dialog with correct group info
  - [x] TR-2.2: Dialog shows full paths and agent names
  - [x] TR-2.3: Dialog shows permanent deletion warning
  - [x] TR-2.4: Delete button disabled until correct name typed
  - [x] TR-2.5: Delete button enabled when name matches
  - [x] TR-2.6: Cancel closes dialog without triggering delete
  - [x] TR-2.7: Delete triggers onDelete with correct groupRowKeys
  - [x] TR-2.8: Single-path rows show dialog correctly
  - [x] TR-2.9: Delete button disabled during deleting state

## [x] Task 3: Update tests
- **Priority**: high
- **Depends On**: Task 2
- **Description**: Adapt existing tests and add new test cases for the two-step delete flow.
- **Validation**:
  - [x] TR-3.1: All 195 tests pass after adaptation
  - [x] TR-3.2: New test verifies dialog appears
  - [x] TR-3.3: New test verifies destructive confirm behavior
  - [x] TR-3.4: New test verifies cancel does not trigger delete
  - [x] TR-3.5: New test verifies confirm triggers correct delete

## [x] Task 4: Run full validation
- **Priority**: high
- **Depends On**: Task 3
- **Description**: Run tests, type-check, and build.
- **Validation**:
  - [x] TR-4.1: `npx vitest run` — 195 tests across 36 files, all pass
  - [x] TR-4.2: `npx tsc --noEmit` — no new type errors (8 pre-existing test-file errors remain)
  - [x] TR-4.3: `npm run build` — build succeeds
