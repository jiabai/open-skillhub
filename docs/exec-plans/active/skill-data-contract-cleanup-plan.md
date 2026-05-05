# Skill Data Contract Cleanup Plan

Status: Draft for Review
Updated: 2026-05-06

Design: `docs/design-docs/skill-data-contract-cleanup.md`
Tasks: `docs/exec-plans/active/skill-data-contract-cleanup-tasks.md`

## Purpose / Big Picture

Clean up skill data contract internals while keeping API behavior stable:
upload pipeline duplication, remaining visibility helper adoption, `skill_kind`
ownership, and skill serialization.

## Progress

- [x] Create design doc, plan, and task checklist.
- [ ] Add characterization tests for upload create/update parity.
- [ ] Extract shared upload archive processing.
- [ ] Replace remaining writable visibility literals with domain helpers.
- [ ] Document or codify public/read-only visibility constants.
- [ ] Simplify skill serialization path.
- [ ] Run backend/frontend/docs gates as affected and archive.

## Key Files

- `backend/services/skill_upload.py`
- `backend/domain/skill_visibility.py`
- `backend/repositories/skill.py`
- `backend/api/v1/skills_support/serializer.py`
- `frontend/src/types/index.ts`

## Validation

```bash
uv run pytest tests/test_api_skills.py tests/test_skill_upload_branches.py tests/test_sync_shared_catalogs.py -v
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```
