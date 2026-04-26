# CLAUDE.md

Start with `AGENTS.md` at the repository root. It is the map for this project.

## Fast Entry Points

- Architecture: `ARCHITECTURE.md`
- Execution gates: `docs/EXECUTION_GATES.md`
- Design guidance: `docs/DESIGN.md`
- Security guidance: `docs/SECURITY.md`
- Backend details: `backend/AGENTS.md`
- Frontend details: `frontend/AGENTS.md`
- Active plans: `docs/exec-plans/active/index.md`
- Product specs: `docs/product-specs/index.md`

## Practical Rules

- Keep changes small and aligned with existing boundaries.
- Before calling work complete, apply `docs/EXECUTION_GATES.md` for the affected area.
- Treat `AGENTS.md` files as concise entry points, not encyclopedias.
- Put detailed plans, decisions, and references under `docs/`.
- Use the backend runtime capability contract as the source of truth for frontend feature availability.
- Avoid changing `desktop-client/` unless the task explicitly includes it.

## Useful Commands

```bash
uv run pytest
uv run ruff check .
uv run mypy backend
cd frontend && npm run lint
cd frontend && npm test
docker compose up -d --build migrate
docker compose up -d api webui
```
