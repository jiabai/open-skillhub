# Upload Button Label Simplification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task after human review. Steps use checkbox
> (`- [ ]`) syntax in the sibling task file for progress tracking.

**Goal:** Remove the skill name from the upload button label in the Local
Skills view so the button displays only the action word ("Upload" / "上传")
instead of "Upload {name}" / "上传 {name}".

**Architecture:** The `upload` i18n key changes from a function
`(name: string) => string` to a plain `string`. The component no longer passes
the skill name to the label. No logic, IPC, or layout changes are required.

**Tech Stack:** TypeScript, React, existing i18n infrastructure.

---

## Scope

- Change `localSkillsView.upload` from `(name: string) => string` to `string`
  in the i18n type definition.
- Update the English and Chinese message dictionaries to use plain strings.
- Update the component to render `copy.upload` instead of `copy.upload(name)`.

## Non-Goals

- No changes to the upload logic, IPC flow, or error handling.
- No changes to other views or components that use skill names in their
  action buttons.
- No changes to the layout, styling, or component structure.

## Progress

- [x] 2026-05-04: Reviewed `local-skills-view.tsx`, `types.ts`, `en-US.ts`,
  `zh-CN.ts`.
- [x] 2026-05-04: Created product spec in English and Chinese.
- [x] 2026-05-04: Created this execution plan and task checklist.

## Decisions

- The `upload` key becomes a plain string. The `uploading` key remains a
  plain string and is unaffected.
- No other i18n keys are changed. The `homeView.distribute` and
  `homeView.syncLocalRecord` keys continue to accept a name parameter because
  those buttons are not in a list context where the name is already visible.

## File Map

Created:

| File | Responsibility |
|------|----------------|
| `docs/product-specs/2026-05-04-upload-button-label-simplification.md` | English product spec |
| `docs/product-specs/2026-05-04-upload-button-label-simplification-zh.md` | Chinese product spec |
| `docs/exec-plans/active/2026-05-04-upload-button-label-simplification.md` | This execution plan |
| `docs/exec-plans/active/2026-05-04-upload-button-label-simplification-tasks.md` | Task checklist |

Modified (planned):

| File | Change |
|------|--------|
| `src/i18n/messages/types.ts` | Change `upload: (name: string) => string` to `upload: string` |
| `src/i18n/messages/en-US.ts` | Change `upload` from function to `"Upload"` |
| `src/i18n/messages/zh-CN.ts` | Change `upload` from function to `"上传"` |
| `src/components/local-skills-view.tsx` | Change `copy.upload(name)` to `copy.upload` |
| `src/__tests__/app.test.tsx` | Update button assertions from `"Upload local-only"` to `"Upload"` |

## Implementation Tasks

See `2026-05-04-upload-button-label-simplification-tasks.md`.

## Validation Plan

```bash
cd desktop-client
npm test
npm run build
cd ..
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

## Validation Results

- `npm test`: 108 tests pass (2026-05-04).
- `npm run build`: passes (2026-05-04).
- `python scripts/validate_agents_docs.py --level ERROR`: 0 errors, 0 warnings (2026-05-04).
- `git diff --check`: passes (CRLF warnings only, no errors) (2026-05-04).
