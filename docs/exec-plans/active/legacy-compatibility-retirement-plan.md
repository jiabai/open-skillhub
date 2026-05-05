# Legacy Compatibility Retirement Plan

Status: Draft for Review
Updated: 2026-05-06

Design: `docs/design-docs/legacy-compatibility-retirement.md`
Tasks: `docs/exec-plans/active/legacy-compatibility-retirement-tasks.md`

## Purpose / Big Picture

Retire compatibility shims and legacy fallbacks only after proving current code
and data no longer need them.

## Progress

- [x] Create design doc, plan, and task checklist.
- [ ] Replace legacy `user_state.py` imports in tests/helpers.
- [ ] Add checks for remaining legacy imports.
- [ ] Add migration/backfill proof for clone source metadata.
- [ ] Add usage proof or tests for legacy `ValueError` mapper removal.
- [ ] Remove safe-to-delete compatibility paths.
- [ ] Run backend/docs gates and archive.

## Key Files

- `backend/core/security/user_state.py`
- `tests/sso_helpers.py`
- `backend/repositories/skill.py`
- `backend/api/v1/skills_support/error_mapper.py`

## Validation

```bash
rg "backend\.core\.security\.user_state" tests backend
uv run pytest tests/test_migrations_clone_sources.py tests/test_api_skills.py -v
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```
