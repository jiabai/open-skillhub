# Project Skill Loading Exec Plan

## Goal

Implement a desktop-client Projects view that lets operators register local
project folders, scan project-level agent skills, and explicitly import a
validated local skill folder into a selected project agent skills target.

## Scope

- Add project record persistence in `config/projects.json`.
- Add catalog metadata for project-relative agent skill paths.
- Add main-process project target resolution, skill scan, source validation, and
  import services.
- Add typed IPC, preload bridge, and renderer IPC client methods.
- Add Projects navigation, list/detail views, dialogs, and activity feedback.
- Add English and Chinese i18n copy.
- Add focused tests for storage, path safety, scan, import, IPC, and renderer
  behavior.
- Update docs that describe the implemented runtime and security surface after
  implementation.

## Non-Goals

- No backend API changes.
- No server upload or distribution changes.
- No automatic project discovery.
- No background project scanning.
- No project file deletion when removing a project record.
- No support for agents outside the current desktop-client supported catalog.

## Progress

- [x] 2026-05-07: Reviewed root workflow, execution gates, desktop-client
  AGENTS guidance, task tracker, active plan index, architecture, design,
  security, runtime references, existing Local Skills implementation, IPC, app
  shell, i18n types, storage helpers, and agent catalog.
- [x] 2026-05-07: Rewrote
  `docs/product-specs/2026-05-07-project-skill-loading.md` from a UI design
  draft into a canonical local product spec with scope, non-goals, storage,
  IPC, safety, and acceptance criteria.
- [x] 2026-05-07: Added
  `docs/design-docs/project-skill-loading.md` technical design.
- [x] 2026-05-07: Added this active ExecPlan and sibling task checklist.
- [x] 2026-05-07: Updated product spec index, design doc index, active
  ExecPlan index, and desktop task tracker.
- [x] 2026-05-07: Ran documentation validation and whitespace checks for this
  planning pass.
- [x] 2026-05-07: Implemented project shared types, `projectsFilePath`,
  `config/projects.json` storage, project target catalog metadata, project
  target resolution, skill metadata parsing, scan service, import service,
  IPC/preload/client bridge methods, main-process handlers, Projects renderer
  view, i18n, tests, CSS, and implementation docs.
- [x] 2026-05-07: Ran focused project service tests, App renderer tests,
  Electron typecheck, full desktop tests, desktop build, docs validator, and
  whitespace check.
- [x] 2026-05-07: Archived this plan and sibling checklist to completed after
  implementation validation.

## Decisions

- Project records live in `config/projects.json`, not `config.json`,
  `agent-paths.json`, SQLite state, or renderer storage.
- Project target paths must be catalog metadata. Global home-directory target
  paths must not be reused for project scanning or import.
- Project skill identity uses the Local Skills rule: valid `slug` first, then
  valid `name`.
- Compatible project read paths may contribute scan results but are never import
  write targets.
- Import destination is resolved only in the main process from project ID and
  target agent ID. The renderer never sends a destination path.
- Same-name target conflicts require explicit overwrite confirmation.
- Project remove deletes only the persisted project record.
- `ProjectAgentTarget` records `writableAgentIds` separately from
  `coveredAgentIds` so compatible-read agents can share scan paths without
  becoming writable import choices.
- Project import returns a redacted import result; the renderer refreshes the
  project scan after import.

## File Map

Create:

| File | Responsibility |
|------|----------------|
| `src/core/storage/project-config.ts` | Read/write/validate `config/projects.json` |
| `src/core/projects/project-agent-targets.ts` | Resolve project-relative agent skill targets from catalog metadata |
| `src/core/projects/project-skill-metadata.ts` | Parse `SKILL.md` frontmatter and resolve safe identity |
| `src/core/projects/project-skill-scan-service.ts` | Scan project targets and merge project/global rows |
| `src/core/projects/project-skill-import-service.ts` | Validate and copy source skill folders into project targets |
| `src/components/projects-view.tsx` | Projects list/detail UI and dialogs |
| `src/__tests__/project-config.test.ts` | Project config persistence tests |
| `src/__tests__/project-agent-targets.test.ts` | Project target resolution tests |
| `src/__tests__/project-skill-scan-service.test.ts` | Scan and merge tests |
| `src/__tests__/project-skill-import-service.test.ts` | Import, conflict, and path safety tests |

Modify:

| File | Change |
|------|--------|
| `src/adapters/agents/definitions.ts` | Add project target metadata |
| `src/core/storage/app-paths.ts` | Add `projectsFilePath` |
| `src/types/index.ts` | Add project records, targets, scan, validation, and import result types |
| `electron/ipc.ts` | Add typed project IPC channels and handler signatures |
| `electron/preload.ts` | Expose project bridge methods |
| `electron/main.ts` | Wire project storage, scan, import, folder picker, and folder reveal handlers |
| `src/lib/ipc-client.ts` | Add typed renderer IPC wrappers |
| `src/app/App.tsx` | Add Projects view state, navigation behavior, and activity feedback |
| `src/components/app-shell.tsx` | Add `projects` view and nav item after Updates |
| `src/i18n/messages/types.ts` | Add Projects copy contract |
| `src/i18n/messages/en-US.ts` | Add English copy |
| `src/i18n/messages/zh-CN.ts` | Add Chinese copy |
| `docs/ARCHITECTURE.md` | After implementation, document project storage/services as current behavior |
| `docs/SECURITY.md` | After implementation, document project import security rules |
| `docs/references/runtime-and-storage-surface.md` | After implementation, document `projects.json`, IPC channels, and storage surface |
| `task-tracker.md` | Track this active work and completion |
| `docs/exec-plans/active/index.md` | Track this active plan and task checklist |

## Implementation Steps

1. Add shared project types and `projectsFilePath`.
2. Write failing project config tests.
3. Implement project config storage.
4. Add project target catalog metadata and target resolution tests.
5. Implement project target resolution and dedupe.
6. Write skill metadata parsing tests for `slug`, `name`, invalid identity, and
   description/version parsing.
7. Implement project skill metadata helpers.
8. Write scan service tests for project rows, invalid rows, shared targets,
   global merge, and project-over-global precedence.
9. Implement scan service.
10. Write import service tests for source validation, destination conflict,
    overwrite, symlink rejection, and path escape rejection.
11. Implement import service.
12. Add IPC/preload/client contracts and source-level tests where useful.
13. Wire Electron main-process handlers, including native directory selection
    and folder reveal.
14. Add renderer tests for Projects navigation, empty state, list actions,
    detail scan, import validation, and overwrite confirmation.
15. Implement Projects view and app state.
16. Add English and Chinese i18n copy.
17. Update architecture, security, runtime references, task tracker, and this
    plan with actual implementation results.
18. Run validation gates.
19. Move this plan and checklist to `completed/` after implementation is
    accepted.

## Validation Plan

Required before implementation is complete:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Recommended focused iteration commands:

```bash
cd desktop-client && npm test -- src/__tests__/project-config.test.ts
cd desktop-client && npm test -- src/__tests__/project-agent-targets.test.ts
cd desktop-client && npm test -- src/__tests__/project-skill-scan-service.test.ts
cd desktop-client && npm test -- src/__tests__/project-skill-import-service.test.ts
cd desktop-client && npm test -- src/__tests__/app.test.tsx
cd desktop-client && npm run typecheck:electron
```

If implementation changes backend API contracts, also run:

```bash
uv run pytest tests/test_client_skills_api.py -q
```

## Validation Results

- `python scripts\validate_agents_docs.py --level ERROR` passed with 0 errors
  and 0 warnings on 2026-05-07.
- `git diff --check` exited 0 on 2026-05-07. PowerShell reported CRLF
  normalization warnings only.
- `cd desktop-client && npm test -- src/__tests__/project-config.test.ts
  src/__tests__/project-agent-targets.test.ts
  src/__tests__/project-skill-scan-service.test.ts
  src/__tests__/project-skill-import-service.test.ts` passed with 16 tests on
  2026-05-07 after the expected red run for missing project modules.
- `cd desktop-client && npm test -- src/__tests__/app.test.tsx` passed with 23
  tests on 2026-05-07.
- `cd desktop-client && npm run typecheck:electron` passed on 2026-05-07.
- `cd desktop-client && npm test` passed with 24 files and 132 tests on
  2026-05-07.
- `cd desktop-client && npm run build` passed on 2026-05-07.

## Documentation Results

- Product spec:
  `../../product-specs/2026-05-07-project-skill-loading.md`
- Technical design:
  `../../design-docs/project-skill-loading.md`
- Task checklist:
  `2026-05-07-project-skill-loading-tasks.md`

## Follow-Up Notes

- V1 ships deterministic project target mappings for current supported
  `AgentId` values except OpenClaw, whose global priority target model does not
  have one canonical project-relative write target yet.
- The UI allows manual path text entry and native folder selection. All path
  validation still happens in the Electron main process.
- Project scans source global rows from the current Local Skills snapshot, but
  only rows under `~/.agents/skills` are shown as global project-detail rows.
  If server lookup is unavailable, local rows can still be scanned and the
  project scan proceeds with best-effort global context.

## Outcome

Implemented and archived. Project Skill Loading now has persisted project
records, project skill scanning, explicit validated import, typed IPC, renderer
UI, i18n, tests, and updated architecture/security/runtime documentation.
