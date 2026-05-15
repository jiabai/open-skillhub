# Linux CLI Skill Distribution Task Checklist

Status: completed and archived

## Documentation Gate

- [x] Review root workflow, desktop-client guidance, current docs indexes,
  task tracker, package scripts, Vite config, distribution service, and state
  database shape.
- [x] Confirm v1 product boundaries with grill-me review.
- [x] Add product spec:
  `desktop-client/docs/product-specs/2026-05-13-linux-cli-distribution.md`.
- [x] Add technical design:
  `desktop-client/docs/design-docs/linux-cli-distribution.md`.
- [x] Add active ExecPlan:
  `desktop-client/docs/exec-plans/completed/2026-05-13-linux-cli-distribution.md`.
- [x] Add this task checklist.
- [x] Run documentation validation for the planning pass.
- [x] Human review approves implementation.

## Implementation Gate

- [x] Add CLI build skeleton, `commander`, `bin`, and `build:cli`.
- [x] Add Linux XDG path resolution and non-secret CLI config.
- [x] Add scoped CLI sync state.
- [x] Add local directory and zip package source preparation.
- [x] Add global/project target resolution and dry-run planning.
- [x] Add conflict and overwrite classification.
- [x] Extract shared distribution write engine from desktop distribution
  service.
- [x] Implement local `install`.
- [x] Implement server-backed `sync`.
- [x] Implement `detect`.
- [x] Implement `config show`, `config set api-base-url`, and `config paths`.
- [x] Add human and JSON output rendering.
- [x] Update README, architecture, security, and runtime storage docs after
  implementation.
- [x] Update this ExecPlan with implementation progress and validation notes.

## Validation Gate

- [x] `cd desktop-client && npm test -- src/__tests__/cli-main.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/cli-app-paths.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/cli-package-source.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/cli-targets.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/cli-distribution-planner.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/cli-sync-state.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/cli-sync-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/distribution-write-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/cli-install-command.test.ts`
- [x] `cd desktop-client && npm test`
- [x] `cd desktop-client && npm run build:cli`
- [x] `cd desktop-client && npm run build`
- [x] Planning pass: `python scripts/validate_agents_docs.py --level ERROR`
- [x] Planning pass: `git diff --check`
- [x] Implementation pass: `python scripts/validate_agents_docs.py --level ERROR`
- [x] Implementation pass: `git diff --check`
- [x] Backend contracts unchanged or backend gates completed if API contracts
  change.

## Completion Gate

- [x] Confirm every acceptance criterion in the product spec is implemented or
  recorded as a follow-up.
- [x] Move this checklist and the ExecPlan to
  `desktop-client/docs/exec-plans/completed/` after implementation acceptance.
- [x] Update active and completed ExecPlan indexes during archival.
- [x] Move the task tracker item from In Progress to Done during archival.
