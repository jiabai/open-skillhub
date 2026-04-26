# Open SkillHub AGENTS.md

## Quick Entry

- Architecture map: `ARCHITECTURE.md`
- Mandatory workflow: `WORKFLOW.md`
- Execution gates: `docs/EXECUTION_GATES.md`
- Repository validator: `scripts/validate_agents_docs.py`
- Design rules: `docs/DESIGN.md`
- Security rules: `docs/SECURITY.md`
- Design docs: `docs/design-docs/index.md`
- Product specs: `docs/product-specs/index.md`
- Active execution plans: `docs/exec-plans/active/index.md`
- Completed execution plans: `docs/exec-plans/completed/index.md`
- Tech debt tracker: `docs/exec-plans/tech-debt-tracker.md`
- Quality scorecard: `docs/QUALITY_SCORE.md`
- Backend-specific guidance: `backend/AGENTS.md`
- Frontend-specific guidance: `frontend/AGENTS.md`
- Desktop client guidance: `desktop-client/AGENTS.md`

## Core Beliefs

- Humans steer; agents execute in small, reviewable steps.
- Durable knowledge must live in the repository, not in chat history.
- Keep boundaries explicit: API -> service -> repository -> database.
- The backend owns runtime capability truth; the frontend consumes that contract.
- Prefer stable documentation and focused plans over long, brittle instruction files.

## Repo Map

| Area | Path | Purpose |
|------|------|---------|
| Backend API | `backend/` | FastAPI app, services, repositories, models, migrations |
| Frontend console | `frontend/` | Next.js web UI, API client, i18n, runtime config consumers |
| Desktop client | `desktop-client/` | Electron sync client with its own guidance |
| Shared data | `shared/` | Build-time shared JSON such as user statuses |
| Tests | `tests/` | Backend pytest suite |
| Deployment | `deploy/` | Nginx and deployment assets |
| Project docs | `docs/` | Specs, plans, references, quality, security, design |

## Working Rules

- Start with the narrowest relevant `AGENTS.md`, then read deeper docs only as needed.
- Follow `WORKFLOW.md` as the mandatory project workflow and `docs/EXECUTION_GATES.md` before closing work; use the lightweight path only when `WORKFLOW.md` explicitly allows it.
- Repo-wide active work lives under `docs/exec-plans/active/`; use sibling task checklist files in that directory when a plan needs explicit execution checkpoints.
- `desktop-client/` keeps its own `desktop-client/task-tracker.md`; do not create a second parallel tracker inside that subproject.
- When architecture or process changes, update the matching file in `docs/`.
- Keep AGENTS quick-entry paths valid and relative to the file that declares them.
- Keep `AGENTS.md` files as maps; move detailed or fast-changing material into `docs/`.
- Do not commit secrets, machine-specific environment paths, or generated local state.
- Avoid unrelated refactors while working on a feature or bug.

## Development Flow

1. Read `WORKFLOW.md` and decide whether the task requires the full gated flow or the lightweight path.
2. Read the relevant spec or plan in `docs/product-specs/` or `docs/exec-plans/`, or create/update them when the workflow requires it.
3. Inspect the code path you are about to change.
4. Implement the smallest end-to-end change that satisfies the approved scope.
5. Run the execution gates for the affected area, starting with the narrowest useful validation and broadening when risk requires it.
6. Update documentation when structure, decisions, process, or operational guidance changed.

## Common Commands

### Backend

```bash
uv sync --locked --extra dev
uv run alembic -c backend/alembic.ini upgrade head
uv run uvicorn backend.api_app:app --host 0.0.0.0 --port 8001
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```

### Frontend

```bash
cd frontend && npm install
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run lint
cd frontend && npm test
```

### Docker

```bash
docker compose up -d --build migrate
docker compose up -d api webui
docker compose logs -f
docker compose down
```

## When to Read More

- For backend boundaries, auth, or data model changes: `backend/AGENTS.md`
- For frontend routing, i18n, or UI work: `frontend/AGENTS.md`
- For deployment behavior: `docs/deployment.md` or `docs/deployment-zh.md`
- For architectural orientation: `ARCHITECTURE.md`
- For open design questions or debt: `docs/design-docs/` and `docs/exec-plans/`
