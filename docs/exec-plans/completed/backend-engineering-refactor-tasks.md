# Backend Engineering Refactor Tasks

Updated: 2026-05-05
Status: Completed
Plan: `docs/exec-plans/completed/backend-engineering-refactor-plan.md`

## Task 1: Middleware Regression Tests

- [x] Add focused tests proving `RequestLoggingMiddleware` and
  `RateLimitMiddleware` no longer subclass `BaseHTTPMiddleware`.
- [x] Add focused behavior coverage proving unexpected exceptions are shaped by
  the centralized FastAPI exception handler instead of request logging middleware.
- [x] Keep existing rate-limit behavior coverage for `429` response shape and
  cleanup semantics.
- Validation:
  - `uv run pytest tests/test_app_startup.py tests/test_rate_limit_cleanup.py tests/test_request_metrics.py tests/test_api_auth.py -q`

## Task 2: Pure ASGI Logging Middleware

- [x] Convert `RequestLoggingMiddleware` to pure ASGI.
- [x] Preserve request method/path/status logging for HTTP requests.
- [x] Let exceptions propagate to the registered exception handlers.
- Validation:
  - focused tests from Task 1

## Task 3: Pure ASGI Rate Limit Middleware

- [x] Convert `RateLimitMiddleware` to pure ASGI.
- [x] Preserve `ENABLE_RATE_LIMIT`, `RATE_LIMIT_REQUESTS`, and
  `RATE_LIMIT_WINDOW` behavior.
- [x] Preserve in-memory cleanup behavior and `RATE_LIMIT_EXCEEDED` response
  shape.
- Validation:
  - focused tests from Task 1

## Task 4: Docs And Gates

- [x] Update the plan progress, decisions, and validation notes.
- [x] Update tech debt tracker for remaining production distributed rate-limit
  storage work.
- [ ] Run backend and documentation hard gates:
  - [x] `uv run pytest`
  - [x] `uv run ruff check .`
  - [x] `uv run mypy backend`
  - [x] `python scripts/validate_agents_docs.py --level ERROR`
- [x] Move this plan and task checklist to `docs/exec-plans/completed/`, then
  update active/completed indexes.
