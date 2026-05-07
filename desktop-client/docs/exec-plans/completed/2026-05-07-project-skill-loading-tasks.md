# Project Skill Loading Task Checklist

Status: completed and archived

## Documentation Gate

- [x] Review root `WORKFLOW.md`, root `docs/EXECUTION_GATES.md`, root
  `AGENTS.md` guidance from the task context, and `desktop-client/AGENTS.md`.
- [x] Review desktop architecture, design, security, runtime references, product
  spec index, design-doc index, active ExecPlan index, and task tracker.
- [x] Review current agent catalog, AppShell navigation, Local Skills view,
  IPC/preload/client bridge, storage helper, app paths, and i18n type surface.
- [x] Rewrite `desktop-client/docs/product-specs/2026-05-07-project-skill-loading.md`
  into a canonical product spec.
- [x] Add `desktop-client/docs/design-docs/project-skill-loading.md`.
- [x] Add `desktop-client/docs/exec-plans/active/2026-05-07-project-skill-loading.md`.
- [x] Add this task checklist.
- [x] Update product spec, design doc, active ExecPlan, and task tracker indexes.
- [x] Run documentation validation and whitespace check.

## Implementation Gate

- [x] Add project shared types in `desktop-client/src/types/index.ts`.
- [x] Add `projectsFilePath` to `desktop-client/src/core/storage/app-paths.ts`.
- [x] Write failing tests in `desktop-client/src/__tests__/project-config.test.ts`.
- [x] Implement `desktop-client/src/core/storage/project-config.ts`.
- [x] Add project target metadata to
  `desktop-client/src/adapters/agents/definitions.ts`.
- [x] Write failing target tests in
  `desktop-client/src/__tests__/project-agent-targets.test.ts`.
- [x] Implement `desktop-client/src/core/projects/project-agent-targets.ts`.
- [x] Write failing metadata and scan tests in
  `desktop-client/src/__tests__/project-skill-scan-service.test.ts`.
- [x] Implement `desktop-client/src/core/projects/project-skill-metadata.ts`.
- [x] Implement
  `desktop-client/src/core/projects/project-skill-scan-service.ts`.
- [x] Write failing import tests in
  `desktop-client/src/__tests__/project-skill-import-service.test.ts`.
- [x] Implement
  `desktop-client/src/core/projects/project-skill-import-service.ts`.
- [x] Add project IPC channels and handler signatures in
  `desktop-client/electron/ipc.ts`.
- [x] Expose project methods in `desktop-client/electron/preload.ts`.
- [x] Add typed renderer wrappers in `desktop-client/src/lib/ipc-client.ts`.
- [x] Wire main-process services and IPC handlers in
  `desktop-client/electron/main.ts`, including directory picker and folder
  reveal behavior.
- [x] Add Projects copy contract in
  `desktop-client/src/i18n/messages/types.ts`.
- [x] Add English copy in `desktop-client/src/i18n/messages/en-US.ts`.
- [x] Add Chinese copy in `desktop-client/src/i18n/messages/zh-CN.ts`.
- [x] Write renderer tests in `desktop-client/src/__tests__/app.test.tsx` for
  Projects navigation, empty state, detail scan, and import validation.
- [x] Implement `desktop-client/src/components/projects-view.tsx`.
- [x] Wire Projects state and actions in `desktop-client/src/app/App.tsx`.
- [x] Add `projects` to `AppView` and navigation in
  `desktop-client/src/components/app-shell.tsx`.
- [x] Add activity events for project add, rename, remove, scan failure, import
  success, and import failure.
- [x] Update `desktop-client/docs/ARCHITECTURE.md` with implemented project
  storage and service surfaces.
- [x] Update `desktop-client/docs/SECURITY.md` with implemented project import
  path safety rules.
- [x] Update `desktop-client/docs/references/runtime-and-storage-surface.md`
  with `projects.json`, project IPC channels, and new runtime behavior.
- [x] Update the ExecPlan progress, decisions, and validation notes.

## Validation Gate

- [x] `cd desktop-client && npm test -- src/__tests__/project-config.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/project-agent-targets.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/project-skill-scan-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/project-skill-import-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/app.test.tsx`
- [x] `cd desktop-client && npm run typecheck:electron`
- [x] `cd desktop-client && npm test`
- [x] `cd desktop-client && npm run build`
- [x] `python scripts/validate_agents_docs.py --level ERROR`
- [x] `git diff --check`
- [x] Backend contracts unchanged; backend Client API gate not required.

## Completion Gate

- [x] Confirm every acceptance criterion in
  `desktop-client/docs/product-specs/2026-05-07-project-skill-loading.md` is
  implemented or recorded as a follow-up note.
- [x] Record new follow-up notes in the completed ExecPlan.
- [x] Move this checklist and the ExecPlan to
  `desktop-client/docs/exec-plans/completed/`.
- [x] Update `desktop-client/docs/exec-plans/active/index.md` and
  `desktop-client/docs/exec-plans/completed/index.md` during archival.
- [x] Move the task tracker item from In Progress to Done during archival.
