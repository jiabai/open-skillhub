# Public Skill Import CLI Tasks

## Task 1: Record the contract in docs

- [x] Add `docs/product-specs/2026-04-22-public-skill-import-cli.md`.
- [x] Add `docs/design-docs/public-skill-sync-cli.md`.
- [x] Update `docs/product-specs/index.md`, `docs/design-docs/index.md`, and `docs/exec-plans/active/index.md`.
- Validation: `python scripts/validate_agents_docs.py --level ERROR`

## Task 2: Refactor the sync command

- [x] Update `backend/scripts/sync_public_skills.py` to support a targeted skill name and an explicit storage-root override.
- [x] Keep the existing full-sync behavior when no skill name is provided.
- [x] Keep the same public-skill persistence model and version handling.
- Dependencies: Task 1 is complete so the contract is documented before code changes land.
- Validation: `uv run python backend/scripts/sync_public_skills.py --help` and a focused manual single-skill run against a test dataset.

## Task 3: Expand backend test coverage

- [x] Add targeted-mode tests to `tests/test_sync_public_skills.py`.
- [x] Cover missing skill, missing `SKILL.md`, invalid skill name, and host-side storage-root behavior.
- [x] Confirm full-sync deactivation behavior still passes.
- Dependencies: Task 2.
- Validation: `uv run pytest tests/test_sync_public_skills.py -v`

## Task 4: Update deployment guidance

- [x] Document the host-side preprod command and the runtime-capability preconditions in `docs/deployment.md`.
- [x] Mirror the same guidance in `docs/deployment-zh.md`.
- [x] Make the host-vs-container path distinction explicit.
- Dependencies: Task 2.
- Validation: `python scripts/validate_agents_docs.py --level ERROR`

## Task 5: Final verification

- [x] Run the focused pytest coverage.
- [x] Confirm the host-side import command exits with code `0`.
- [ ] Confirm the target skill is stored as `visibility=public` and `is_active=true`.
- [ ] Confirm `GET /api/v1/skills/public` returns the imported skill.
- [ ] Confirm `GET /api/v1/runtime-config` reports `public_skills=true` and the public Skills page shows the skill.
- [x] Run the docs validator.
- Dependencies: Tasks 2 to 4.
