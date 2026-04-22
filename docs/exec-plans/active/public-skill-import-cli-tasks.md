# Public Skill Import CLI Tasks

## Task 1: Record the contract in docs

- [x] Add `docs/product-specs/2026-04-22-public-skill-import-cli.md`.
- [x] Add `docs/design-docs/public-skill-sync-cli.md`.
- [x] Update `docs/product-specs/index.md`, `docs/design-docs/index.md`, and `docs/exec-plans/active/index.md`.
- Validation: `python scripts/validate_agents_docs.py --level ERROR`

## Task 2: Refactor the sync command

- [ ] Update `backend/scripts/sync_public_skills.py` to support a targeted skill name and an explicit storage-root override.
- [ ] Keep the existing full-sync behavior when no skill name is provided.
- [ ] Keep the same public-skill persistence model and version handling.
- Dependencies: Task 1 is complete so the contract is documented before code changes land.
- Validation: `uv run python backend/scripts/sync_public_skills.py --help` and a focused manual single-skill run against a test dataset.

## Task 3: Expand backend test coverage

- [ ] Add targeted-mode tests to `tests/test_sync_public_skills.py`.
- [ ] Cover missing skill, missing `SKILL.md`, invalid skill name, and host-side storage-root behavior.
- [ ] Confirm full-sync deactivation behavior still passes.
- Dependencies: Task 2.
- Validation: `uv run pytest tests/test_sync_public_skills.py -v`

## Task 4: Update deployment guidance

- [ ] Document the host-side preprod command and the runtime-capability preconditions in `docs/deployment.md`.
- [ ] Mirror the same guidance in `docs/deployment-zh.md`.
- [ ] Make the host-vs-container path distinction explicit.
- Dependencies: Task 2.
- Validation: `python scripts/validate_agents_docs.py --level ERROR`

## Task 5: Final verification

- [ ] Run the focused pytest coverage.
- [ ] Run the docs validator.
- [ ] Verify a single imported skill is visible in the public Skills page once `public_skills=true`.
- Dependencies: Tasks 2 to 4.
