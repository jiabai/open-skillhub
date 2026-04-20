# User Status Build-Time Catalog Sync

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective were kept up to date as work proceeded.
It is now archived as a completed plan and retained for regression reference.

## Purpose / Big Picture

User status definitions should be authored once while remaining safe to package and
deploy. After this follow-up, `shared/user-statuses.json` is the single authoring
source, but backend and frontend each consume their own synced local copy at
runtime:

- backend reads `backend/domain/user-statuses.json`
- frontend reads `frontend/src/generated/user-statuses.json`

The visible result is that future builds and Docker images no longer depend on the
root `shared/` directory at runtime, while drift between authored and runtime
catalogs is prevented by an explicit sync/check script and focused tests.

## Progress

- [x] (2026-04-20 15:47) Add `scripts/sync_shared_catalogs.py` with explicit
  `--write` and `--check` modes for the user-status catalog
- [x] (2026-04-20 15:47) Generate and commit the frontend-local runtime copy at
  `frontend/src/generated/user-statuses.json`
- [x] (2026-04-20 15:47) Switch frontend imports to the generated catalog and
  remove direct root `shared/` runtime dependency from frontend Docker/dev wiring
- [x] (2026-04-20 15:47) Add focused backend, frontend, and script-level
  consistency validation
- [x] (2026-04-20 15:47) Update deployment and reference docs to describe the
  build-time sync workflow
- [x] (2026-04-20 16:05) Reclassify broader enum consolidation into the separate
  active plan `docs/exec-plans/active/enum-catalog-consolidation-plan.md`

## Surprises & Discoveries

- Observation: backend packaging was already safe for the local runtime copy.
  Evidence: `pyproject.toml` already includes backend package data for
  `**/*.json`, so `backend/domain/user-statuses.json` remains package-local
  without extra packaging changes.

- Observation: the frontend build and dev overlay still depended on root
  `shared/` before this follow-up.
  Evidence: `frontend/Dockerfile` copied `shared/` into the build context, and
  `docker-compose.dev.yml` bind-mounted `./shared` into the frontend workspace.

## Decision Log

- Decision: use build-time sync plus committed generated copies instead of direct
  runtime imports from root `shared/`.
  Rationale: this preserves one authoring source without coupling backend or
  frontend runtime behavior to repository layout.
  Date/Author: 2026-04-20 / Codex

- Decision: keep backend runtime reads inside `backend/domain/`.
  Rationale: the backend package and Docker image already treat package-local JSON
  as stable runtime assets.
  Date/Author: 2026-04-20 / Codex

- Decision: place the frontend runtime copy under `frontend/src/generated/`.
  Rationale: the file becomes a frontend-local import target that works in Next.js,
  Vitest, and Docker builds without reaching outside the subproject tree.
  Date/Author: 2026-04-20 / Codex

- Decision: require an explicit sync/check command rather than hidden prebuild
  hooks.
  Rationale: the workflow stays visible during release and CI, and drift failures
  point directly at one remediation command.
  Date/Author: 2026-04-20 / Codex

- Decision: split `role`, `visibility`, and `skill_kind` into a new active plan
  instead of forcing them into the final step of this one.
  Rationale: user status is complete, while the remaining enum-like concepts have
  broader and more varied semantics across RBAC, editable skill visibility, and
  backend-derived read models.
  Date/Author: 2026-04-20 / Codex

## Outcomes & Retrospective

Completed in this follow-up:

- added an explicit sync/check script for the shared user-status catalog
- made frontend consume a committed generated catalog copy
- removed frontend runtime dependence on root `shared/` in Docker/dev wiring
- added focused tests that guard backend constants, generated files, and sync logic
- updated build/deployment docs to require sync verification before image builds

This plan is complete and archived.

Later follow-up work is tracked separately:

- `role`, `visibility`, and `skill_kind` now belong to
  `docs/exec-plans/active/enum-catalog-consolidation-plan.md`

Still intentionally out of scope for this archived plan:

- rewriting historical migration snapshots

## Context and Orientation

### Current Authoring and Runtime Paths

| Path | Role |
|------|------|
| `shared/user-statuses.json` | Single editable source of truth |
| `backend/domain/user-statuses.json` | Synced backend runtime copy |
| `frontend/src/generated/user-statuses.json` | Synced frontend runtime copy |
| `backend/domain/user_status.py` | Backend consumer of the local runtime copy |
| `frontend/src/lib/user-status.ts` | Frontend consumer of the local generated copy |
| `scripts/sync_shared_catalogs.py` | Explicit sync/check entrypoint |

### Validation Anchors

| Path | Why it matters |
|------|----------------|
| `tests/test_sync_shared_catalogs.py` | Backend + sync-script consistency coverage |
| `frontend/src/__tests__/user-status.test.ts` | Frontend generated-catalog coverage |
| `frontend/Dockerfile` | Frontend image should not copy root `shared/` |
| `docker-compose.dev.yml` | Dev overlay should not depend on a shared bind mount for frontend runtime |

## Plan of Work

The user-status workflow now follows this sequence:

1. Edit only `shared/user-statuses.json`.
2. Run `python scripts/sync_shared_catalogs.py --write` to regenerate the backend
   and frontend runtime copies.
3. Commit the updated generated copies together with the source change.
4. Run `python scripts/sync_shared_catalogs.py --check` before release, CI, or
   Docker image builds.

Broader enum follow-up work continues in a separate active plan.

## Concrete Steps

### Sync after editing the authoring source

```bash
cd D:\Github\open-skillhub
python scripts/sync_shared_catalogs.py --write
```

Expected result: the script rewrites:

- `backend/domain/user-statuses.json`
- `frontend/src/generated/user-statuses.json`

### Verify generated copies before build or release

```bash
cd D:\Github\open-skillhub
python scripts/sync_shared_catalogs.py --check
```

Expected result: `Shared catalogs are in sync.`

### Focused backend validation

```bash
cd D:\Github\open-skillhub
$env:UV_CACHE_DIR='D:\Github\open-skillhub\.uv-cache'; uv run pytest tests/test_sync_shared_catalogs.py -q
```

Expected result: the backend/shared consistency checks pass.

### Focused frontend validation

```bash
cd D:\Github\open-skillhub\frontend
npm.cmd test -- --run src/__tests__/user-status.test.ts
```

Expected result: the frontend generated-catalog tests pass.

## Validation and Acceptance

Validation flow:

1. Run `python scripts/sync_shared_catalogs.py --check`
   - Expect success in a synced repository.
2. Run backend validation:
   - `$env:UV_CACHE_DIR='D:\Github\open-skillhub\.uv-cache'; uv run pytest tests/test_sync_shared_catalogs.py -q`
   - Expect the shared/backend catalog comparison and sync-script behavior tests to pass.
3. Run frontend validation:
   - `npm.cmd test -- --run src/__tests__/user-status.test.ts`
   - Expect the generated catalog import test to pass.
4. Run docs validation when this plan or related references change:
   - `python scripts/validate_agents_docs.py --level ERROR`
   - Expect zero errors.

Acceptance criteria:

- `shared/user-statuses.json` is the only file that should be edited by hand.
- backend and frontend runtime imports do not depend on root `shared/`.
- drift is caught by a single explicit `--check` command.
- Docker and deployment docs describe the sync-before-build requirement clearly.
