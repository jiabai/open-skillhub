# Backend AGENTS.md

Use this file when you are changing the FastAPI backend. Read the root `AGENTS.md` first for project-wide entry points.

## Quick Entry

- Architecture map: `ARCHITECTURE.md`
- Security guidance: `docs/SECURITY.md`
- Active plans: `docs/exec-plans/active/index.md`
- Tech debt tracker: `docs/exec-plans/tech-debt-tracker.md`

## Backend Map

| Area | Path | Purpose |
|------|------|---------|
| App bootstrap | `backend/api_app.py` | FastAPI factory, middleware, health endpoints, exception shaping |
| Routing | `backend/api/`, `backend/api/router.py` | REST route modules and top-level router registration |
| Business logic | `backend/services/` | Auth, skills, tokens, audit, email, SSO, runtime config |
| Data access | `backend/repositories/` | Repository classes that own database queries |
| Data model | `backend/models/` | SQLAlchemy models with UUID primary keys |
| DTOs | `backend/schemas/` | Pydantic request and response schemas |
| Cross-cutting | `backend/core/` | Middleware, permissions, security helpers, utility modules |
| Configuration | `backend/config/settings.py` | Environment-driven settings and validators |
| Database plumbing | `backend/db/` | Async sessions and Alembic migrations |
| Domain rules | `backend/domain/` | Shared enums and domain-level validation |

## Boundary Rules

- Routes should validate input, wire dependencies, and delegate workflow logic to services.
- Services own business rules and orchestration; they should not embed raw HTTP concerns.
- Repositories own SQLAlchemy query behavior and persistence details.
- Schema changes require an Alembic migration under `backend/db/migrations/versions/`.
- New feature flags belong in `backend/config/settings.py` and, when UI-facing, in the runtime config contract.

## Common Tasks

### Add an API endpoint

1. Create or extend schemas in `backend/schemas/`.
2. Add the route in `backend/api/v1/`.
3. Implement or extend a service in `backend/services/`.
4. Add repository support in `backend/repositories/` if persistence changes.
5. Register the router in `backend/api/router.py` when needed.
6. Add or update tests in `tests/`.

### Change the database

1. Update the model in `backend/models/`.
2. Generate and review an Alembic migration.
3. Run `uv run alembic -c backend/alembic.ini upgrade head`.
4. Run the narrowest affected pytest coverage.

## Validation

```bash
uv run pytest
uv run pytest tests/path/to/file.py
uv run ruff check .
uv run mypy backend
```

## Notes

- Keep the backend async end-to-end for I/O paths.
- API error payloads should keep the `detail`, `code`, `timestamp` shape.
- Runtime capability truth belongs to the backend and feeds the frontend contract.
- The desktop client is a separate subproject; do not assume backend changes automatically require desktop-client edits.
