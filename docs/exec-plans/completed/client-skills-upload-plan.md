# Client Skills Upload API

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

Programmatic clients need an API-token-only way to upload complete ZIP-packaged
skills. The visible result is a new `POST /api/v1/client/skills/upload` endpoint
that can either create a user-owned skill from `SKILL.md` or append a new version
to an existing user-owned skill, without changing the existing Web Console upload
endpoint.

This plan intentionally stops before implementation until the spec and plan are
reviewed.

## Progress

- [x] (2026-05-01) Reviewed repository workflow, governance docs, backend upload route, API-token dependencies, upload coordinator, error mapping, and client skills tests.
- [x] (2026-05-01) Revised the product spec to clarify API-token-only auth, ZIP-only scope, status code semantics, metadata limits, error codes, and acceptance criteria.
- [x] (2026-05-01) Added the durable design note and indexed the feature documents.
- [x] (2026-05-01) Added this active ExecPlan and sibling task checklist for implementation after review.
- [x] (2026-05-01) Updated `ARCHITECTURE.md` and `docs/SECURITY.md` so API Token client scope includes upload as well as metadata/download.
- [x] (2026-05-01) Ran documentation validation: `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors and 0 warnings.
- [x] (2026-05-02) Added Client API upload tests covering create, append-version, auth boundaries, invalid archives, create-mode metadata rejection, duplicate create, reference read-only, and audit events.
- [x] (2026-05-02) Implemented `POST /api/v1/client/skills/upload` in `backend/api/v1/client_skills.py`.
- [x] (2026-05-02) Ran `uv run pytest tests/test_client_skills_api.py -v`; all 10 tests passed.
- [x] (2026-05-02) Ran `uv run pytest tests/test_api_skills.py tests/test_client_skills_api.py -v`; all 49 tests passed.
- [x] (2026-05-02) Updated stale mock targets in `tests/test_skill_upload_branches.py` from `backend.services.skill.*` to the actual `skill_upload` and `skill_lifecycle` import sites so the full pytest suite can exercise current code structure.
- [x] (2026-05-02) Ran `uv run pytest`; all 633 tests passed.
- [x] (2026-05-02) Ran `uv run ruff check .`; passed.
- [x] (2026-05-02) Ran `python scripts/validate_agents_docs.py --level ERROR`; passed with 0 errors and 0 warnings.
- [x] (2026-05-04) `uv run mypy backend` now passes: `Success: no issues found in 140 source files`. The 142 baseline errors were resolved by prior type-cleanup work outside this feature.

## Surprises & Discoveries

- Observation: `POST /api/v1/skills/upload` currently returns `201 Created` for both ZIP creation and ZIP version append.
  Evidence: `backend/api/v1/skills.py` decorates the upload route with `status_code=status.HTTP_201_CREATED`.

- Observation: the existing create-from-ZIP coordinator does not accept `metadata`, while update-from-ZIP does.
  Evidence: `SkillService.upload_zip_create_skill_from_path(...)` accepts `visibility` only; `SkillService.upload_zip_from_path(...)` accepts `metadata_text`.

- Observation: duplicate skill creation is currently mapped to `409`, not `400`.
  Evidence: `backend/api/v1/skills_support/error_mapper.py` maps `SkillErrorCode.SKILL_ALREADY_EXISTS` to `HTTP_409_CONFLICT`.

- Observation: existing Client API routes already reject JWT access tokens by using API-token dependencies.
  Evidence: `tests/test_client_skills_api.py` checks JWT auth against `GET /api/v1/client/skills` and expects `401`.

- Observation: the full pytest suite had stale mock targets in `tests/test_skill_upload_branches.py` that still patched `backend.services.skill.*` even though upload and lifecycle helpers now live in `backend.services.skill_upload` and `backend.services.skill_lifecycle`.
  Evidence: the first full `uv run pytest` failed 5 tests with `AttributeError` for missing `save_archive`, `delete_skill_dir`, and `list_archive_versions` attributes on `backend.services.skill`.

- Observation: the backend mypy baseline previously did not pass independently of this feature (142 errors around `enum.StrEnum` under `python_version = "3.13"` and `SkillErrorCode` typing).
  Resolution: the baseline was resolved by prior type-cleanup work. As of 2026-05-04, `uv run mypy backend` reports `Success: no issues found in 140 source files`.

## Decision Log

- Decision: return `201 Created` for both create and append-version modes.
  Rationale: appending a version creates a new version record and matches the existing Console upload endpoint.
  Date/Author: 2026-05-01 / Codex

- Decision: keep `metadata` update-only for this endpoint.
  Rationale: existing coordinator support is update-only, and create mode should have one source of truth: ZIP `SKILL.md`.
  Date/Author: 2026-05-01 / Codex

- Decision: keep the endpoint ZIP-only.
  Rationale: the client sync workflow uploads complete skills; single-file edits remain a Console API concern.
  Date/Author: 2026-05-01 / Codex

- Decision: implement this as a backend-only API surface first.
  Rationale: the user requested documentation and planning before code, and desktop-client integration can follow after the backend contract is reviewed.
  Date/Author: 2026-05-01 / Codex

## Outcomes & Retrospective

Implementation is complete and all backend gates pass. The mypy baseline that
previously blocked this plan has been resolved by prior type-cleanup work.
All acceptance criteria are met.

## Context and Orientation

### Current state

| Path | Why it matters |
|------|----------------|
| `backend/api/v1/client_skills.py` | Existing Client API router with list and download endpoints; target location for upload |
| `backend/api/v1/skills.py` | Existing Console upload route to mirror where appropriate |
| `backend/core/deps.py` | Contains `require_api_token_permission(...)` and API-token-only auth behavior |
| `backend/api/v1/skills_support/upload.py` | Provides streaming temporary upload handling |
| `backend/api/v1/skills_support/error_mapper.py` | Maps `SkillErrorCode` values into HTTP errors |
| `backend/api/v1/skills_support/audit.py` | Creates audit events |
| `backend/services/skill.py` | Public service facade for upload operations |
| `backend/services/skill_upload.py` | ZIP validation, version creation, archive persistence, and create-from-ZIP logic |
| `tests/test_client_skills_api.py` | Best home for new Client API upload regression tests |
| `tests/test_api_skills.py` | Existing Console upload tests that should remain unaffected |

### Related docs

- `docs/product-specs/2026-05-01-client-skills-upload.md`
- `docs/design-docs/client-skills-upload-api.md`
- `docs/exec-plans/completed/client-skills-upload-tasks.md`
- `docs/exec-plans/completed/skills-api-boundary-plan.md`

## Plan of Work

### Phase 1: Backend tests first

Add focused tests to `tests/test_client_skills_api.py` before implementation:

1. API Token with `skill.upload` can create a new skill from a ZIP.
2. API Token with `skill.upload` can append a version to an existing owned skill.
3. missing token returns `401`.
4. JWT access token returns `401`.
5. token owner without `skill.upload` returns `403`.
6. non-ZIP or bad ZIP returns `400` with `INVALID_ZIP_FILE`.
7. missing `SKILL.md` returns the mode-appropriate missing-code response.
8. duplicate create returns `409` with `SKILL_ALREADY_EXISTS`.
9. reference skill append returns `409` with `REFERENCE_SKILL_READ_ONLY`.
10. create mode with `metadata` returns `400` with `INVALID_METADATA`.
11. successful create and append write audit events.

### Phase 2: Implement the route

Update `backend/api/v1/client_skills.py`:

1. Import `File`, `Form`, `HTTPException`, `UploadFile`, and `status`.
2. Import `MAX_TOTAL_SIZE`.
3. Import `create_audit_event`, `handle_skill_value_error`, and `stream_upload_to_temp_file`.
4. Add `@router.post("/upload", status_code=status.HTTP_201_CREATED)`.
5. Use `require_api_token_permission("skill.upload")`.
6. Stream to a temporary file and always clean it up.
7. Reject create-mode `metadata` before calling the service.
8. Call the existing service upload methods for create and append modes.
9. Write audit events only after successful service calls.

### Phase 3: Preserve existing Console behavior

Run or add regression checks showing `POST /api/v1/skills/upload` still behaves as before. No Console API route should move or change authentication.

### Phase 4: Validation and docs

Update this plan's Progress, Surprises & Discoveries, Decision Log, and validation notes as implementation proceeds. Keep product/design docs stable unless implementation reveals a contract issue.

## Concrete Steps

### Step 1: Add failing Client API upload tests

```bash
cd D:\Github\skilldrive
uv run pytest tests/test_client_skills_api.py -v
```

Expected before implementation: new upload tests fail because `/api/v1/client/skills/upload` is not implemented.

### Step 2: Implement the endpoint

```bash
cd D:\Github\skilldrive
# edit backend/api/v1/client_skills.py
uv run pytest tests/test_client_skills_api.py -v
```

Expected after implementation: all Client API tests pass.

### Step 3: Run focused upload regressions

```bash
cd D:\Github\skilldrive
uv run pytest tests/test_api_skills.py tests/test_client_skills_api.py -v
```

Expected: Console upload and Client API upload behavior both pass.

### Step 4: Run backend gates

```bash
cd D:\Github\skilldrive
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```

Expected: all backend and documentation gates pass, or any skipped broad gate is recorded in this plan and final handoff with residual risk.

## Validation and Acceptance

Validation flow:

1. Run focused Client API tests with `uv run pytest tests/test_client_skills_api.py -v`.
2. Run Console upload regression coverage with relevant `tests/test_api_skills.py` cases.
3. Run backend default gates from `docs/EXECUTION_GATES.md`.
4. Run `python scripts/validate_agents_docs.py --level ERROR`.

Acceptance criteria:

- `POST /api/v1/client/skills/upload` exists under the Client API router.
- The endpoint accepts API Token auth and rejects JWT Session auth.
- Create and append-version modes both work for owned skills.
- The endpoint is ZIP-only.
- Create-mode `metadata` is rejected.
- Error status codes and payload codes match the product spec.
- Audit events are written for both successful modes.
- Existing Console upload behavior is unchanged.
