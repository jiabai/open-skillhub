# Desktop Client Architecture Deepening

Status: completed
Last updated: 2026-05-14
Scope: `desktop-client/`

## Goal

Deepen the highest-leverage desktop-client module boundaries identified in the
architecture review without changing user-visible behavior.

This plan focuses on the first two priorities:

1. Extract shared Client Skill API behavior used by Electron and the Linux CLI.
2. Extract shared skill package tree validation behavior used by CLI install,
   Local Skills upload, and Project Skill import.

The broader opportunities around target resolution, Electron runtime
orchestration, shared contracts, and renderer workflow state are intentionally
left as follow-up work.

## Context

The desktop app and Linux CLI now share agent catalog, layout, distribution
write, and package extraction code. Two important seams remain shallow:

- Client API list/download normalization, checksum checks, and package staging
  are implemented separately in `electron/main.ts` and
  `src/cli/services/cli-sync-service.ts`.
- Skill folder validation rules are repeated across
  `src/cli/services/cli-package-source.ts`,
  `src/core/local-skills/local-skill-upload-package.ts`, and
  `src/core/projects/project-skill-import-service.ts`.

These areas carry security and compatibility risk because small rule drift can
change how packages are accepted, downloaded, or installed.

## Non-Goals

- No backend API contract changes.
- No renderer UI redesign.
- No persistence schema changes.
- No change to the Linux CLI v1 encrypted-download policy.
- No target resolver or Electron runtime extraction in this batch.

## Implementation Plan

### Phase 1: Shared Client Skill API

Create a core module that owns client skill list/download response parsing,
auth header creation, checksum verification, expiration checks, artifact file
name sanitization, and cache staging.

Expected files:

- Create `src/core/client-skills/client-skill-api.ts`.
- Add focused tests in `src/__tests__/client-skill-api.test.ts`.
- Update Electron main to call the shared API module.
- Update CLI sync service to call the shared API module while preserving CLI
  error mapping and encrypted-download exit code `5`.

### Phase 2: Shared Skill Package Tree

Create a core module that owns source tree walking, symlink rejection, realpath
containment, root `SKILL.md` requirement, file count limits, total byte limits,
and reusable copy/zip traversal inputs.

Expected files:

- Create `src/core/skills/skill-package-tree.ts`.
- Add focused tests in `src/__tests__/skill-package-tree.test.ts`.
- Update CLI package source validation to reuse the module.
- Update Local Skills upload packaging to reuse the module for collection.
- Update Project Skill import validation and copy safety to reuse the module
  where it keeps the import behavior unchanged.

## Validation Plan

Run focused tests during implementation:

```bash
cd desktop-client && npm test -- client-skill-api skill-package-tree cli-sync-service cli-package-source local-skill-upload-package project-skill-import-service
```

Run completion gates before closing:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

## Decisions

- 2026-05-14: Limit the first refactor batch to the top two priorities so the
  change remains reviewable.
- 2026-05-14: Preserve existing runtime behavior and public IPC/CLI contracts;
  this is a module-depth refactor, not a feature change.

## Progress

- [x] Architecture review completed and priority order accepted by the user.
- [x] Active ExecPlan and task checklist created.
- [x] Shared Client Skill API tests written and watched fail.
- [x] Shared Client Skill API implementation wired into Electron and CLI.
- [x] Shared Skill Package Tree tests written and watched fail.
- [x] Shared Skill Package Tree implementation wired into CLI, local upload,
  and project import.
- [x] Docs updated for new module boundaries.
- [x] Execution gates passed.

## Risks

- Download behavior must remain fail-closed for encrypted CLI downloads.
- Checksum and expiration differences between existing Electron and CLI paths
  need to be intentionally reconciled, not accidentally changed.
- Package tree traversal is security-sensitive; tests must cover symlinks,
  path escapes, limits, and root `SKILL.md` behavior.

## Validation Notes

- 2026-05-14: `npm test -- client-skill-api` failed first because
  `src/core/client-skills/client-skill-api.ts` did not exist.
- 2026-05-14: `npm test -- client-skill-api cli-sync-service` passed after
  adding the shared Client Skill API module and wiring CLI sync to it.
- 2026-05-14: `npm run typecheck:electron` passed after wiring Electron main to
  the shared Client Skill API module.
- 2026-05-14: `npm test -- skill-package-tree` failed first because
  `src/core/skills/skill-package-tree.ts` did not exist.
- 2026-05-14: `npm test -- client-skill-api cli-sync-service cli-package-source local-skill-upload-package project-skill-import-service skill-package-tree` passed after wiring the shared Skill Package Tree module into CLI local sources, Local Skills upload packaging, and Project Skill import.
- 2026-05-14: Initial full `npm test` run failed because
  `electron-shell.test.ts` still asserted that download staging lived in
  `electron/main.ts`; the test was updated to check `main.ts` delegation plus
  the new `src/core/client-skills/client-skill-api.ts` implementation.
- 2026-05-14: `npm test` passed with 35 test files and 181 tests.
- 2026-05-14: `npm run build` passed.
- 2026-05-14: `npm run build:cli` passed.
- 2026-05-14: `python scripts\validate_agents_docs.py --level ERROR` passed
  with 0 errors and 0 warnings.
- 2026-05-14: `git diff --check` passed with CRLF warnings only.
