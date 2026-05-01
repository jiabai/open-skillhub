# Client Skills Upload API Tasks

## Task 1: Record the contract in docs

- [x] Revise `docs/product-specs/2026-05-01-client-skills-upload.md`.
- [x] Add `docs/design-docs/client-skills-upload-api.md`.
- [x] Add `docs/exec-plans/active/client-skills-upload-plan.md`.
- [x] Add this task checklist.
- [x] Update `ARCHITECTURE.md` and `docs/SECURITY.md` for the client upload API-token boundary.
- [x] Run `python scripts/validate_agents_docs.py --level ERROR`.
- Validation: `python scripts/validate_agents_docs.py --level ERROR` passed on 2026-05-01 with 0 errors and 0 warnings.

## Task 2: Add Client API upload tests

- [x] Add create-from-ZIP success coverage to `tests/test_client_skills_api.py`.
- [x] Add append-version success coverage to `tests/test_client_skills_api.py`.
- [x] Cover missing token, JWT token, and token without `skill.upload`.
- [x] Cover non-ZIP or invalid ZIP.
- [x] Cover missing `SKILL.md` in create and append modes.
- [x] Cover duplicate skill create.
- [x] Cover reference skill append rejection.
- [x] Cover create-mode `metadata` rejection.
- [x] Cover audit events for `skill.create` and `skill.upload`.
- Dependencies: Task 1.
- Validation: `uv run pytest tests/test_client_skills_api.py -v` passed on 2026-05-02.

## Task 3: Implement the Client API upload route

- [x] Update `backend/api/v1/client_skills.py` imports.
- [x] Add `POST /upload` with `require_api_token_permission("skill.upload")`.
- [x] Stream uploads through `stream_upload_to_temp_file(file, MAX_TOTAL_SIZE)`.
- [x] Reject create-mode `metadata` with `INVALID_METADATA`.
- [x] Call `service.upload_zip_from_path(...)` when `skill_uuid` is supplied.
- [x] Call `service.upload_zip_create_skill_from_path(...)` when `skill_uuid` is absent.
- [x] Create audit events after successful service calls.
- [x] Close the upload file and remove the temporary file in `finally`.
- Dependencies: Task 2.
- Validation: `uv run pytest tests/test_client_skills_api.py -v` passed on 2026-05-02.

## Task 4: Verify Console upload remains unchanged

- [x] Run existing Console upload regression tests.
- [x] Confirm `POST /api/v1/skills/upload` still uses JWT Session auth.
- [x] Confirm its response status and payload shape are unchanged.
- Dependencies: Task 3.
- Validation: `uv run pytest tests/test_api_skills.py tests/test_client_skills_api.py -v` passed on 2026-05-02.

## Task 5: Final backend and docs gates

- [x] Run `uv run pytest`.
- [x] Run `uv run ruff check .`.
- [x] Run `uv run mypy backend`.
- [ ] Resolve the existing backend mypy baseline failure or get owner acceptance of residual risk.
- [x] Run `python scripts/validate_agents_docs.py --level ERROR`.
- [x] Update `docs/exec-plans/active/client-skills-upload-plan.md` with final progress, discoveries, decisions, and validation notes.
- Dependencies: Tasks 2 to 4.
- Validation:
  - `uv run pytest` passed on 2026-05-02 with 633 tests.
  - `uv run ruff check .` passed on 2026-05-02.
  - `python scripts/validate_agents_docs.py --level ERROR` passed on 2026-05-02 with 0 errors and 0 warnings.
  - `uv run mypy backend` failed on 2026-05-02 with 142 existing baseline errors, primarily around `enum.StrEnum` under the configured Python 3.10 mypy target and existing `SkillErrorCode` typing.
