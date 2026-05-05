# List Count Consistency Plan

Status: Draft for Review
Updated: 2026-05-06

Spec: `docs/product-specs/2026-05-06-list-count-consistency.md`
Design: `docs/design-docs/list-count-consistency.md`
Tasks: `docs/exec-plans/active/list-count-consistency-tasks.md`

## Purpose / Big Picture

Make list/count consistency explicit for paginated APIs so clients know whether
`items` and `total` come from one stable view or accepted eventual consistency.

## Progress

- [x] Create spec, design doc, plan, and task checklist.
- [ ] Inventory list endpoints returning `items` and `total`.
- [ ] Choose consistency strategy per endpoint.
- [ ] Add tests for selected behavior.
- [ ] Implement repository/API changes.
- [ ] Run backend/docs gates and archive.

## Key Files

- `backend/api/v1/skills.py`
- `backend/api/v1/users.py`
- `backend/api/v1/tokens.py`
- `backend/repositories/skill.py`
- `backend/repositories/user.py`
- `backend/repositories/token.py`

## Validation

```bash
uv run pytest tests/test_api_skills.py tests/test_users_api.py tests/test_api_tokens.py -v
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```
