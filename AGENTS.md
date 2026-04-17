# AGENTS.md

Guidance for AI coding agents working with this repository.

## Project Overview

Open SkillHub — a private **Skills management SaaS** platform for AI agents with MCP (Model Context Protocol) integration. Multi-tenant, JWT-authenticated, with a web console and HTTP/SSE MCP endpoints.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, SQLAlchemy 2.0 (async), Pydantic 2, Alembic |
| Frontend | Next.js 14 (App Router), TypeScript, React 18, shadcn/ui, Tailwind CSS |
| Database | SQLite (default/development), PostgreSQL (production) |
| Auth | Email OTP, SSO (OIDC + PKCE), LDAP; JWT access + refresh tokens |
| Packaging | UV (Python), npm (Node.js) |
| Deployment | Docker Compose (multi-stage builds), Nginx reverse proxy |

## Project Structure

```
backend/              # Python FastAPI application (see backend/AGENTS.md for details)
  __init__.py         #   Package version (0.1.2)
  api_app.py          #   FastAPI app factory (create_application)
  main.py             #   CLI entry point (standalone MCP mode)
  api/                #   REST routes + MCP handlers
    v1/               #     REST API v1 routes
    mcp/              #     MCP endpoint handlers
  config/             #   Settings (Pydantic BaseSettings, env-driven)
  core/               #   Middleware, security, MCP tool operations
    tools/            #     Individual MCP tool implementations
    middleware/       #     Auth, rate limit, deprecation middleware
    security/         #     JWT, password hashing
    permissions.py    #     RBAC permission definitions
  db/                 #   Alembic migrations, async session management
  domain/             #   Domain logic (user status enums)
  models/             #   SQLAlchemy ORM models (all inherit BaseModel, UUID PKs)
  repositories/       #   Data access layer (one repo per model, extends BaseRepository)
  schemas/            #   Pydantic request/response DTOs
  services/           #   Business logic layer
frontend/             # Next.js 14 web console (see frontend/AGENTS.md for details)
  src/app/            #   Pages: login, dashboard, skills, public-skills, tokens,
                      #          profile, security, audit, admin, register
  src/components/     #   shadcn/ui components + app-specific components
  src/lib/            #   API client (api.ts), runtime-config, navigation, utils
  src/hooks/          #   Custom React hooks (form validation, runtime config, toast)
  src/i18n/           #   Internationalization (zh-CN, en-US)
  src/types/          #   TypeScript type definitions
  src/__tests__/      #   Vitest component tests
desktop-client/       # Electron desktop sync client (see desktop-client/AGENTS.md)
  electron/           #   Main-process runtime, preload bridge, IPC handlers
  src/                #   Renderer UI, sync/distribution core, storage, adapters
  docs/               #   Local architecture, security, specs, and exec plans
shared/               # Shared data between backend and frontend (user-statuses.json)
tests/                # Backend pytest suite (56 test files)
  conftest.py         #   Fixtures: async engine, session, httpx client
deploy/nginx/         #   Nginx reverse proxy configuration
docs/                 #   Deployment guides, architecture docs
```

## Development Commands

### Backend

```bash
pip install -e ".[dev]"                    # Install with dev dependencies
uvicorn backend.api_app:app --port 8001    # Start API server
alembic upgrade head                        # Run all DB migrations
pytest                                     # Run all backend tests
pytest tests/path/to/file.py               # Run a single test file
ruff check .                               # Lint
ruff check --fix .                         # Lint with auto-fix
mypy backend/                              # Type check
```

### Frontend

```bash
cd frontend && npm install                  # Install dependencies
cd frontend && npm run dev                  # Start dev server (port 3000)
cd frontend && npm run build                # Production build
cd frontend && npm run lint                 # ESLint
cd frontend && npm test                     # Run Vitest tests
cd frontend && npm run test:watch           # Watch mode
```

### Desktop Client

```bash
cd desktop-client && npm install            # Install dependencies
cd desktop-client && npm test               # Run Vitest tests
cd desktop-client && npm run build          # Type check Electron + build renderer
cd desktop-client && npm run typecheck:electron  # Electron TypeScript only
```

### Docker

```bash
docker compose up -d --build                # Build and start all services
docker compose logs -f                      # Follow logs
docker compose down                         # Stop services
```

| Service | Container Port | Host Port | Description |
|---------|---------------|-----------|-------------|
| API | 8001 | (internal) | FastAPI backend |
| WebUI | 3000 | 127.0.0.1:3000 | Next.js web console |
| Migrate | — | — | Runs Alembic migrations on startup |

> Default Docker setup uses SQLite. For PostgreSQL, add a `db` service — see `docs/deployment.md`.

## Architecture

### Request Flow

```
Request → API Router → Service → Repository → DB (SQLAlchemy async)
         ↓
       MCP Handlers → Core Tools → Service Layer
```

### Layer Responsibilities

- **api/v1/** — REST routes (`GET /api/v1/...`), includes auth, skills, tokens, users, dashboard, audit, admin, runtime-config
- **api/mcp/** — MCP protocol handlers (`/mcp` POST, `/sse` GET) exposing 7 MCP tools
- **services/** — Business logic: auth, token, user, audit, email, verification, skill CRUD, SSO OIDC, skill download/clone
- **repositories/** — Data access, one repo per model, extends `BaseRepository` with common CRUD
- **models/** — SQLAlchemy models, all inherit `BaseModel` (UUID `id`, `created_at`, `updated_at`)
- **schemas/** — Pydantic v2 DTOs for request validation and response serialization
- **core/** — Cross-cutting: middleware stack, security utilities, RBAC permissions, MCP tool implementations

See `backend/AGENTS.md` for complete backend architecture details, including auth flow, permission system, settings, and conventions.

### Authentication Flow

1. Users authenticate via **email OTP**, **SSO (OIDC/PKCE)**, or **LDAP**
2. Web API returns JWT access token (30 min) + refresh token (7 days)
3. MCP endpoints use API tokens (prefixed `ask_live_...`) for bearer auth
4. Token-based auth identifies the user and isolates their private skill space

### Frontend Architecture

- Next.js 14 App Router with shadcn/ui + Tailwind CSS — see `frontend/AGENTS.md` for full details
- API client at `frontend/src/lib/api.ts` — handles JWT refresh automatically on 401
- Feature flags and runtime capabilities come from backend `/api/v1/runtime-config`, consumed via `frontend/src/lib/runtime-config.ts`
- Next.js rewrites `/api/*` to backend `API_INTERNAL_URL` (default `http://api:8001`)
- Standalone output mode for Docker deployment
- Custom i18n system: cookie-based locale resolution, dictionary pattern with zh-CN and en-US
- Two UI modes: "personal workspace" (no RBAC) and "governed console" (RBAC enabled)

## Conventions

### Code Style

- **Python**: async everywhere (SQLAlchemy async sessions, asyncpg, aiosqlite); all I/O is non-blocking
- **TypeScript**: strict mode, `@` path alias maps to `src/`
- All model primary keys are UUID strings
- API error responses follow a consistent shape: `{"detail": "...", "code": "...", "timestamp": "..."}`

### Naming

- MCP tool operation functions use `_OP` suffix (e.g., `load_skill_OP`)
- Repository classes follow `{Model}Repository` pattern, extending `BaseRepository`
- Service classes follow `{Domain}Service` pattern
- Schema classes use `{Entity}Create`, `{Entity}Update`, `{Entity}Response` pattern

### Database

- Migrations managed by Alembic — always create migrations for schema changes (`backend/db/migrations/versions/`)
- Settings validate production safety at startup (e.g., SECRET_KEY >= 32 chars, no wildcard CORS in production)
- SQLite for development/testing, PostgreSQL for production

### Testing

- **Backend**: pytest + pytest-asyncio, httpx `AsyncClient` with `ASGITransport` for integration tests
  - `tests/conftest.py` sets up in-memory SQLite, deterministic verification codes ("123456"), all feature flags enabled
  - Each test gets a clean database via `reset_database` fixture (autouse)
- **Frontend**: Vitest + jsdom + @testing-library/react
  - Config at `frontend/vitest.config.ts`, setup at `frontend/src/test/setup.ts`
  - `@` alias resolves to `frontend/src/`

### Environment Configuration

- Backend: `backend/.env.example` (140 lines) — database, security, 13+ feature flags, SMTP, SSO, LDAP
- Frontend: `frontend/.env.example` — single variable `NEXT_PUBLIC_API_BASE_URL`
- Feature flags control auth methods, RBAC, audit, rate limiting, metrics, skill visibility, encryption, sandboxing
- All settings are validated by Pydantic on startup

## Common Tasks

### Adding a new API endpoint

1. Define schema in `backend/schemas/`
2. Add route in `backend/api/v1/`
3. Implement business logic in `backend/services/`
4. Add repository methods in `backend/repositories/` if DB access needed
5. Register router in `backend/api/router.py`
6. Add tests in `tests/`
7. Update Alembic migration if schema changed
8. See `backend/AGENTS.md` for the complete checklist and conventions

### Adding a new MCP tool

1. Create tool implementation in `backend/core/tools/`
2. Register in MCP handler (`backend/api/mcp/`)
3. Add tests in `tests/`

### Adding a frontend page

1. Create directory under `frontend/src/app/` with `page.tsx`
2. Add components in `frontend/src/components/`
3. Use API client from `frontend/src/lib/api.ts`
4. Check feature flags via `useRuntimeConfig()` hook
5. Add i18n keys to `frontend/src/i18n/messages/` (zh-CN, en-US, types)
6. See `frontend/AGENTS.md` for the complete checklist

### Modifying the database schema

1. Update model in `backend/models/`
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review and edit the generated migration
4. Test with `alembic upgrade head`
5. Verify with `pytest`
6. See `backend/AGENTS.md` for the complete model/repo creation workflow

## Important Notes

- Never commit `.env` files — they are gitignored; use `.env.example` as template
- The `shared/` directory contains data shared between backend and frontend at build time
- Docker images run as non-root users (`skillhub` / `nextjs`)
- Backend Docker image uses UV for dependency management with lockfile (`uv.lock`)
- Frontend requires rebuild when `NEXT_PUBLIC_API_BASE_URL` changes (env is baked at build time)
- The `data/` directory is gitignored; skill files are stored per-user in isolated directories
