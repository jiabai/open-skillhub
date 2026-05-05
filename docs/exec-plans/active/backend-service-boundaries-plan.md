# Backend Service Boundaries Plan

Status: Draft for Review
Updated: 2026-05-06

Design: `docs/design-docs/backend-service-boundaries.md`
Tasks: `docs/exec-plans/active/backend-service-boundaries-tasks.md`

## Purpose / Big Picture

Reduce backend boundary drift by standardizing repository transaction behavior
and decomposing the broad `SkillService` facade in reviewable slices.

## Progress

- [x] Create design doc, plan, and task checklist.
- [ ] Add tests that expose inconsistent transaction boundaries.
- [ ] Introduce a Unit of Work or equivalent transaction boundary.
- [ ] Migrate one high-value multi-step skill workflow.
- [ ] Move download crypto helpers out of `SkillService`.
- [ ] Move route consumers toward narrower service providers.
- [ ] Run backend/docs gates and archive.

## Key Files

- `backend/repositories/base.py`
- `backend/repositories/user.py`
- `backend/repositories/skill.py`
- `backend/services/skill.py`
- `backend/services/skill_clone.py`
- `backend/services/skill_upload.py`
- `backend/api/v1/skills_support/service_factory.py`

## Validation

```bash
uv run pytest tests/test_skill_service_integration.py tests/test_repositories.py -v
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```
