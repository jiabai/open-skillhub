# Desktop Client Architecture Deepening Tasks

Status: completed
Last updated: 2026-05-14

## Tasks

- [x] Review desktop-client architecture hotspots and agree priority order.
- [x] Register the active plan in `docs/exec-plans/active/index.md`.
- [x] Add task-tracker entry for architecture deepening.
- [x] Write failing tests for shared client skill list parsing and download
  staging behavior.
- [x] Implement `src/core/client-skills/client-skill-api.ts`.
- [x] Wire Electron package download/list helpers to the shared client API
  module.
- [x] Wire CLI sync HTTP client to the shared client API module while preserving
  CLI-specific errors and encrypted-download refusal.
- [x] Run focused Client Skill API tests and update this checklist with results.
- [x] Write failing tests for shared skill package tree validation.
- [x] Implement `src/core/skills/skill-package-tree.ts`.
- [x] Wire CLI local package source validation to shared package tree rules.
- [x] Wire Local Skills upload packaging to shared package tree traversal.
- [x] Wire Project Skill import validation/copy safety to shared package tree
  helpers where behavior stays equivalent.
- [x] Run focused package tree and affected service tests.
- [x] Update `docs/ARCHITECTURE.md` and `docs/SECURITY.md`.
- [x] Run desktop-client hard gates and docs validator.

## Validation Log

| Command | Result | Notes |
|---------|--------|-------|
| `npm test -- client-skill-api` | Failed as expected | RED: shared module did not exist |
| `npm test -- client-skill-api cli-sync-service` | Passed | Shared Client Skill API behavior and CLI sync regression tests pass |
| `npm run typecheck:electron` | Passed | Electron main wiring typechecks |
| `npm test -- skill-package-tree` | Failed as expected | RED: shared module did not exist |
| `npm test -- client-skill-api cli-sync-service cli-package-source local-skill-upload-package project-skill-import-service skill-package-tree` | Passed | Shared API/package tree modules and affected services pass focused regression tests |
| `npm test` | Failed, then passed | First full run caught stale Electron source-string assertion; after updating the test, all 35 files / 181 tests passed |
| `npm run build` | Passed | Renderer and Electron bundles built |
| `npm run build:cli` | Passed | Linux CLI bundle built |
| `python scripts\validate_agents_docs.py --level ERROR` | Passed | 0 errors, 0 warnings |
| `git diff --check` | Passed | CRLF warnings only |

## Notes

- Keep public IPC, CLI command names, output shapes, and storage schemas stable.
- Do not start the lower-priority target resolver/runtime/UI refactors in this
  batch unless a direct dependency is discovered.
