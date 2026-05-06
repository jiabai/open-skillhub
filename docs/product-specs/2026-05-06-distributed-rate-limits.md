# Distributed Rate Limits

## Background

SkillDrive currently has two rate-limit paths:

- global request limiting in `backend/core/middleware/rate_limit.py`
- download limiting in `backend/api/v1/skills_support/download.py`

Both store counters in process-local memory. This is sufficient for local
development and single-process deployments, but it does not enforce limits across
multiple workers or multiple backend instances.

## Goal

Make rate limits enforceable across production workers while preserving the
current response shape and allowing local development to keep an in-memory store.

## Scope

- Introduce a rate-limit store abstraction.
- Keep an in-memory store for local/dev deployments.
- Add a configurable shared store option for production deployments.
- Apply the abstraction to both global request limiting and download limiting.
- Preserve current `429` response shape.
- Add tests for global and download limiting behavior.

## Non-Goals

- Do not introduce user-facing quota management UI.
- Do not change API permission semantics.
- Do not require Redis for local development.
- Do not add billing or plan-based quota behavior.

## Acceptance Criteria

- Global request limiting and download limiting use a common store interface or
  compatible store contracts.
- Production configuration can select a shared backend explicitly.
- The default local behavior remains easy to run without external services.
- Existing `429` error payloads keep `detail`, `code`, and `timestamp`.
- Backend gates pass:

  ```bash
  uv run pytest
  uv run ruff check .
  uv run mypy backend
  python scripts/validate_agents_docs.py --level ERROR
  ```

## References

- `docs/design-docs/distributed-rate-limit-stores.md`
- `docs/exec-plans/active/distributed-rate-limit-stores-plan.md`
