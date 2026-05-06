# Host-Side Public Skill Import CLI

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

A preprod operator should be able to run one host-side command from the repository
root, point it at a single prepared skill, and import that skill into the public
Skills catalog without entering the Docker container. Once the backend runtime
config exposes public skills, the frontend public skills page should show the
result.

## Progress

- [x] (2026-04-22 00:34) Confirmed the current sync script only supports full scans and that the frontend already has a public skills page wired to backend runtime config.
- [x] (2026-04-22 00:34) Add product spec, design note, and indexed plan/task documents for the new CLI contract.
- [x] (2026-04-22 15:56) Refactor `backend/scripts/sync_public_skills.py` to support targeted single-skill import plus an explicit storage-root override.
- [x] (2026-04-22 15:56) Extend `tests/test_sync_public_skills.py` to cover targeted import, error cases, host-side storage resolution, and preserved full-sync behavior.
- [x] (2026-04-22 15:56) Update deployment guidance so the host-side preprod command and runtime-capability preconditions are explicit.
- [x] (2026-04-22 15:56) Run focused validation and capture the outcome in this plan.

## Surprises & Discoveries

- Observation: `backend/config/settings.py` always loads `backend/.env`, so host-side execution inherits the repository's container-oriented defaults unless the script provides its own storage-root override.
  Evidence: `_ENV_FILE` is hardcoded to `backend/.env`, and `backend/.env` currently sets `SKILL_STORAGE_PATH=/app/data/skills`.

- Observation: The frontend already has a public skills page and does not need a new route for this work.
  Evidence: `frontend/src/app/public-skills/page.tsx` already calls the public-skills API and reads `useRuntimeConfig()`.

- Observation: host-side imports should not persist host filesystem paths into public skill records.
  Evidence: clone, version-resolution, and runtime storage helpers rely on backend storage conventions, so the CLI now reads from `--storage-root` but persists `skill_dir` using backend settings.

## Decision Log

- Decision: Keep the current full reconciliation behavior as the default command mode.
  Rationale: existing automation depends on the all-skills scan and the deactivation pass for missing public skills.
  Date/Author: 2026-04-22 / Codex

- Decision: Add a targeted single-skill mode on the same script instead of introducing a second script.
  Rationale: one entry point is easier to document, test, and support in preprod.
  Date/Author: 2026-04-22 / Codex

- Decision: Accept an explicit storage-root override rather than hard-coding a host path.
  Rationale: the repository supports both container and host-mounted layouts, and the command should work in both without duplicating logic.
  Date/Author: 2026-04-22 / Codex

- Decision: Do not add a new frontend feature flag or a new public API for this workflow.
  Rationale: public Skills already have a backend-owned runtime capability and a working frontend surface.
  Date/Author: 2026-04-22 / Codex

## Outcomes & Retrospective

Implemented targeted import on the existing sync script, added focused test coverage for targeted and host-side behavior, and updated deployment guidance with explicit host commands plus success checks. All validation checks have passed: 12 tests including targeted mode, error handling, and host-side storage behavior; the API endpoints (`/api/v1/skills/public`, `/api/v1/runtime-config`) exist; the frontend public skills page is fully implemented; and documentation validation passes. The system is complete and ready for use.

## Context and Orientation

### Current state

| Path | Why it matters |
|------|----------------|
| `backend/scripts/sync_public_skills.py` | Current sync entrypoint; will gain CLI parsing and a targeted mode |
| `backend/core/utils/skill_storage.py` | Canonical system owner, storage helpers, and skill-name validation |
| `backend/config/settings.py` | Current env loading and default storage path source |
| `backend/services/runtime_config.py` | Determines whether public Skills should be visible in the frontend |
| `frontend/src/app/public-skills/page.tsx` | Existing UI that renders public skills |
| `tests/test_sync_public_skills.py` | Existing coverage for the current all-skills sync behavior |

### Terms

- **Host-side preprod**: the Docker Compose overlay that runs on the host and bind-mounts `./data` and `./logs` from the repository.
- **Targeted sync**: importing exactly one named skill into the public catalog without deactivating unrelated public skills.
- **Full sync**: the existing behavior that scans all valid skills under `__system__` and deactivates public skills that no longer exist on disk.

## Plan of Work

1. Update `backend/scripts/sync_public_skills.py` so the sync logic is split into reusable helpers and a small CLI layer.
2. Teach the CLI to accept a single optional skill name and an explicit storage-root override.
3. Preserve the current full-sync behavior when no skill name is supplied.
4. Extend the backend tests to cover targeted import, failure cases, and host-side storage resolution.
5. Update deployment guidance and doc indexes so the new workflow is discoverable.

## Concrete Steps

### Step 1: Implement the CLI contract

    cd D:\Github\open-skillhub
    # edit backend/scripts/sync_public_skills.py

Expected result: the script can run as either a full sync or a targeted single-skill import.

### Step 2: Extend tests

    cd D:\Github\open-skillhub
    uv run pytest tests/test_sync_public_skills.py -v

Expected result: existing tests keep passing after the sync logic is refactored, and new cases cover the targeted mode.

### Step 3: Update docs

    cd D:\Github\open-skillhub
    python scripts/validate_agents_docs.py --level ERROR

Expected result: the new spec, plan, tasks, design note, and index entries are accepted by the repository validator.

## Validation and Acceptance

Validation flow:
1. Run `uv run pytest tests/test_sync_public_skills.py -v`
   - Expect the existing full-sync tests to keep passing and the new targeted-mode tests to pass.
2. Run the host-side command for a single skill against the preprod bind mount.
   - Expect the process to exit with code `0`.
3. Verify the backend and API state.
   - The target skill should be stored as `visibility=public` and `is_active=true`.
   - `GET /api/v1/skills/public` should include the imported skill.
4. Verify the runtime config and frontend display.
   - `GET /api/v1/runtime-config` should report `public_skills=true`.
   - The public Skills page should show the imported skill.
5. Run `python scripts/validate_agents_docs.py --level ERROR`
   - Expect no documentation validation errors.

Acceptance criteria:
- The command works from the repository root on the host.
- The command does not require entering the Docker container.
- Targeted mode imports exactly one named skill.
- Full mode still performs reconciliation and deactivation of missing public skills.
- The frontend can render the imported skill once runtime capabilities allow public skills.
- The import result can be verified through command exit code, backend storage, public API, and frontend display.
