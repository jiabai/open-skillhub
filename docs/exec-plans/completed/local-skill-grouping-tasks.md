# Local Skill Name Grouping Tasks

## Task Checklist

- [x] Task 1: Add types (`LocalSkillGroupRow`, extend `LocalSkillsInventorySnapshot`, extend `LocalSkillDeletePayload`)
  - Files: `desktop-client/src/types/index.ts`
  - Validation: TypeScript compilation, existing tests pass

- [x] Task 2: Implement grouping logic (`groupSkillRowsByName`, `pickPrimaryRow`)
  - Files: `desktop-client/src/core/local-skills/local-skill-inventory-service.ts`
  - Validation: Unit tests for grouping logic, `npm test`

- [x] Task 3: Update inventory service `refresh()` to return `groupedRows`
  - Files: `desktop-client/src/core/local-skills/local-skill-inventory-service.ts`
  - Validation: Snapshot includes `groupedRows`, existing consumers unaffected

- [x] Task 4: Rewrite `LocalSkillsView` to render grouped rows
  - Files: `desktop-client/src/components/local-skills-view.tsx`
  - Validation: UI renders grouped rows, path tags, version conflict warnings

- [x] Task 5: Update `handleDeleteLocalSkill` to pass `groupRowKeys`
  - Files: `desktop-client/src/app/App.tsx`
  - Validation: Delete clears all paths in group

- [x] Task 6: Update main process delete to support batch `groupRowKeys`
  - Files: `desktop-client/electron/main.ts`
  - Validation: Batch deletion via IPC works correctly

- [x] Task 7: Add i18n keys (`pathCount`, `versionConflict`)
  - Files: `desktop-client/src/i18n/messages/en-US.ts`, `zh-CN.ts`, `types.ts`
  - Validation: Both locales render correctly

- [x] Task 8: Fix test fixture for updated `LocalSkillsInventorySnapshot` type
  - Files: `desktop-client/src/__tests__/project-skill-scan-service.test.ts`
  - Validation: All tests pass

- [x] Task 9: Final validation
  - `npm test` → 36 files, 190 tests pass
  - `npm run build` → build succeeds
  - `python scripts/validate_agents_docs.py --level ERROR` → docs valid