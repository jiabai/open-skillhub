# Upload Button Label Simplification Task Checklist

Status: completed

## Documentation Gate

- [x] Review `local-skills-view.tsx`, `types.ts`, `en-US.ts`, `zh-CN.ts`.
- [x] Create English product spec.
- [x] Create Chinese product spec.
- [x] Create execution plan.
- [x] Create this task checklist.
- [x] Update `docs/product-specs/index.md` with new spec entries.
- [x] Update `docs/exec-plans/active/index.md` with new plan entry.
- [x] Update `task-tracker.md` with this work item.
- [x] Run documentation validation after all doc edits.

## i18n Type Change

- [x] Change `upload: (name: string) => string` to `upload: string` in
  `src/i18n/messages/types.ts`.

## i18n Message Changes

- [x] Change `upload: (name: string) => `Upload ${name}`` to `upload: "Upload"`
  in `src/i18n/messages/en-US.ts`.
- [x] Change `upload: (name: string) => `上传 ${name}`` to `upload: "上传"`
  in `src/i18n/messages/zh-CN.ts`.

## Component Change

- [x] Change `copy.upload(name)` to `copy.upload` in
  `src/components/local-skills-view.tsx`.

## Test Updates

- [x] Update `src/__tests__/app.test.tsx` button assertions from
  `"Upload local-only"` to `"Upload"`.

## Validation Gate

- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] `python scripts/validate_agents_docs.py --level ERROR` passes.
- [x] `git diff --check` passes.

## Archive Gate

- [x] Record validation results in the active plan.
- [x] Move this checklist and the plan to `docs/exec-plans/completed/` after
  validation is complete or document why the plan was superseded.
