# Local Skill Name Grouping Plan

Status: Ready for Review
Updated: 2026-08-25

Spec: `docs/product-specs/2026-08-25-local-skill-name-grouping.md`
Design: `docs/design-docs/local-skill-name-grouping.md`
Tasks: `docs/exec-plans/active/local-skill-grouping-tasks.md`

## Purpose / Big Picture

Group same-name local skills from different paths into a single row in the Local Skills view, with path tags and version conflict detection. Operations (upload/delete) act on the entire group.

## Progress

- [x] Create spec, design doc, plan, and task checklist.
- [x] Add `LocalSkillGroupRow` type and extend snapshot/payload types.
- [x] Implement `groupSkillRowsByName` and `pickPrimaryRow` in inventory service.
- [x] Update `LocalSkillsView` to render grouped rows with path tags.
- [x] Update delete operation to support batch via `groupRowKeys`.
- [x] Add i18n keys for path count and version conflict.
- [x] Run tests and build validation.

## Key Files

- `desktop-client/src/types/index.ts`
- `desktop-client/src/core/local-skills/local-skill-inventory-service.ts`
- `desktop-client/src/components/local-skills-view.tsx`
- `desktop-client/src/app/App.tsx`
- `desktop-client/electron/main.ts`
- `desktop-client/src/i18n/messages/en-US.ts`
- `desktop-client/src/i18n/messages/zh-CN.ts`
- `desktop-client/src/i18n/messages/types.ts`
- `desktop-client/src/__tests__/project-skill-scan-service.test.ts`

## Validation

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
```