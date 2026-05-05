# Audit Permission Consistency Plan

Status: Draft for Review
Updated: 2026-05-06

Design: `docs/design-docs/audit-permission-consistency.md`
Tasks: `docs/exec-plans/active/audit-permission-consistency-tasks.md`

## Purpose / Big Picture

Centralize audit recording defaults and remove raw permission literals from route
dependencies so security-sensitive route behavior is easier to maintain.

## Progress

- [x] Create design doc, plan, and task checklist.
- [ ] Add failing tests for audit recorder defaults.
- [ ] Add failing check for raw permission strings in route files.
- [ ] Introduce audit recorder dependency/helper.
- [ ] Replace route audit call sites in small batches.
- [ ] Replace raw permission strings with `Permission.*` constants.
- [ ] Run backend/docs gates and archive.

## Key Files

- `backend/api/v1/skills.py`
- `backend/api/v1/auth.py`
- `backend/api/v1/tokens.py`
- `backend/api/v1/audit.py`
- `backend/core/permissions.py`
- `backend/core/deps.py`

## Validation

```bash
uv run pytest tests/test_audit_log_api.py tests/test_audit_service.py tests/test_rbac_permissions_comprehensive.py -v
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```
