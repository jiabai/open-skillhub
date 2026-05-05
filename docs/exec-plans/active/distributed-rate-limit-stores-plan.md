# Distributed Rate-Limit Stores Plan

Status: Draft for Review
Updated: 2026-05-06

Spec: `docs/product-specs/2026-05-06-distributed-rate-limits.md`
Design: `docs/design-docs/distributed-rate-limit-stores.md`
Tasks: `docs/exec-plans/active/distributed-rate-limit-stores-tasks.md`

## Purpose / Big Picture

Make global and download rate limits enforceable across production workers while
preserving local zero-dependency behavior.

## Progress

- [x] Create spec, design doc, plan, and task checklist.
- [ ] Add failing store-level and API-level rate-limit tests.
- [ ] Introduce rate-limit store interface and in-memory implementation.
- [ ] Wire `RateLimitMiddleware` to the store boundary.
- [ ] Wire download limiting to the store boundary.
- [ ] Add production shared-store configuration.
- [ ] Run backend/docs gates and archive.

## Key Files

- `backend/core/middleware/rate_limit.py`
- `backend/api/v1/skills_support/download.py`
- `backend/config/settings.py`
- `tests/test_rate_limit_cleanup.py`
- `tests/test_api_skill_download.py`

## Validation

```bash
uv run pytest tests/test_rate_limit_cleanup.py tests/test_api_skill_download.py -v
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```
