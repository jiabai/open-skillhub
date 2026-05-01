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

- [ ] Add create-from-ZIP success coverage to `tests/test_client_skills_api.py`.
- [ ] Add append-version success coverage to `tests/test_client_skills_api.py`.
- [ ] Cover missing token, JWT token, and token without `skill.upload`.
- [ ] Cover non-ZIP or invalid ZIP.
- [ ] Cover missing `SKILL.md` in create and append modes.
- [ ] Cover duplicate skill create.
- [ ] Cover reference skill append rejection.
- [ ] Cover create-mode `metadata` rejection.
- [ ] Cover audit events for `skill.create` and `skill.upload`.
- Dependencies: Task 1.
- Validation: `uv run pytest tests/test_client_skills_api.py -v`.

## Task 3: Implement the Client API upload route

- [ ] Update `backend/api/v1/client_skills.py` imports.
- [ ] Add `POST /upload` with `require_api_token_permission("skill.upload")`.
- [ ] Stream uploads through `stream_upload_to_temp_file(file, MAX_TOTAL_SIZE)`.
- [ ] Reject create-mode `metadata` with `INVALID_METADATA`.
- [ ] Call `service.upload_zip_from_path(...)` when `skill_uuid` is supplied.
- [ ] Call `service.upload_zip_create_skill_from_path(...)` when `skill_uuid` is absent.
- [ ] Create audit events after successful service calls.
- [ ] Close the upload file and remove the temporary file in `finally`.
- Dependencies: Task 2.
- Validation: `uv run pytest tests/test_client_skills_api.py -v`.

## Task 4: Verify Console upload remains unchanged

- [ ] Run existing Console upload regression tests.
- [ ] Confirm `POST /api/v1/skills/upload` still uses JWT Session auth.
- [ ] Confirm its response status and payload shape are unchanged.
- Dependencies: Task 3.
- Validation: focused `tests/test_api_skills.py` upload cases.

## Task 5: Final backend and docs gates

- [ ] Run `uv run pytest`.
- [ ] Run `uv run ruff check .`.
- [ ] Run `uv run mypy backend`.
- [ ] Run `python scripts/validate_agents_docs.py --level ERROR`.
- [ ] Update `docs/exec-plans/active/client-skills-upload-plan.md` with final progress, discoveries, decisions, and validation notes.
- Dependencies: Tasks 2 to 4.
