# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open SkillHub — a private **Skills management SaaS** platform for AI agents with MCP integration. Multi-tenant, JWT-authenticated, with web console and HTTP/SSE MCP endpoints.

## Project Structure

```
backend/          # Python 3.10+ FastAPI application
  api_app.py      #   FastAPI app factory (create_application)
  main.py         #   CLI entry point (FlowLLM standalone MCP mode)
  api/            #   REST routes under /api/v1, MCP handlers
  config/         #   Settings and config
  core/           #   Middleware, security, MCP tool operations
  db/             #   Alembic migrations, session management
  models/         #   SQLAlchemy ORM models
  repositories/   #   Data access layer
  schemas/        #   Pydantic request/response schemas
  services/       #   Business logic layer
frontend/         # Next.js 14 (App Router) web console
  src/app/        #   Pages (login, dashboard, skills, tokens, profile, security, audit, admin)
  src/components/ #   shadcn/ui components
  src/lib/        #   API client, utils
data/skills/      # Skill file storage (per-user isolated)
```

## Development Commands

### Backend (Python)

```bash
pip install -e ".[dev]"                    # Install with dev deps
uvicorn backend.api_app:app --port 8001    # Start API server
alembic upgrade head                        # Run all DB migrations
pytest                                     # Run all tests
pytest tests/path/to/file.py               # Run single test file
ruff check .                               # Lint
ruff check --fix .                         # Lint and auto-fix
mypy backend/                              # Type check
skillhub-mcp                                # Run standalone MCP mode (CLI)
```

### Frontend (Node.js)

```bash
cd frontend && npm install                  # Install deps
cd frontend && npm run dev                  # Start dev server (:3000)
cd frontend && npm run build                # Production build
cd frontend && npm run lint                 # ESLint
cd frontend && npm test                     # Run Vitest tests
cd frontend && npm run test:watch           # Watch mode
```

### Docker

```bash
docker compose up -d --build                # Start all services
docker compose logs -f                      # View logs
docker compose down                         # Stop services
```

| Service    | Port | Description                      |
|------------|------|----------------------------------|
| Frontend   | 80   | Next.js web console              |
| API        | 8001 | FastAPI backend                  |

> Default Docker setup uses SQLite. Add a `db` service for PostgreSQL — see `docs/deployment.md`.

## Architecture

### Backend: Layered Pattern

```
Request → API Router → Service → Repository → DB (SQLAlchemy async)
         ↓
       MCP Handlers → Core Tools → Service Layer
```

- **api/** — REST routes (`GET /api/v1/...`) and MCP handlers (`/mcp`, `/sse`)
- **services/** — business logic (auth, token, user, audit, email, verification)
- **repositories/** — data access (one repo per model, extends `BaseRepository`)
- **models/** — SQLAlchemy models (all inherit from `BaseModel` with UUID IDs)
- **schemas/** — Pydantic DTOs for request/response validation
- **core/** — middleware (auth, rate limit, deprecation), security, MCP tool ops
- **core/tools/** — individual MCP tool implementations (load_skill, execute_skill, run_shell_command, etc.)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  FastAPI Application (backend/api_app.py)               │
│                                                         │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  REST API       │  │  MCP Endpoints                │  │
│  │  /api/v1/*      │  │  /mcp (POST)  /sse (GET)     │  │
│  │                 │  │                               │  │
│  │  Auth / Skills  │  │  7 MCP Tools:                 │  │
│  │  Tokens / Users │  │  load_skill, load_metadata,    │  │
│  │  Dashboard / Audit│ │  read_reference, run_shell,     │  │
│  └────────┬────────┘  │  skill_resource, execute       │  │
│           │           └──────────┬────────────────────┘  │
│           ▼                      ▼                       │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Service Layer                        │    │
│  │  (auth, token, user, audit, email, verification)  │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Repository Layer                     │    │
│  │  (CRUD via SQLAlchemy async sessions)             │    │
│  └──────────────────────┬───────────────────────────┘    │
└─────────────────────────┼────────────────────────────────┘
                          ▼
              ┌──────────────────────┐
              │  SQLite (default) / PostgreSQL (prod)  │
              └──────────────────────┘
```

### Authentication Model

- Users authenticate via **email OTP** (verification code), SSO, or LDAP
- JWT tokens (access + refresh) for web API access
- API tokens (`ask_live_...`) for MCP endpoint access
- Token-based auth identifies user and isolates their private skill space

### Frontend

- Next.js 14 App Router with shadcn/ui + Tailwind CSS
- API client at `frontend/src/lib/api.ts` (supports JWT refresh)
- Key pages: `/` (dashboard), `/skills`, `/public-skills`, `/tokens`, `/profile`, `/security`, `/audit`, `/admin/users`, `/register`
- Feature flags in `frontend/src/lib/feature-flags.ts`

## Conventions

- Python: async everywhere (SQLAlchemy async sessions, asyncpg, aiosqlite)
- All model IDs are UUID
- API error responses include `detail`, `code`, and `timestamp` fields
- MCP tools use `_OP` suffix naming for operation functions
- Frontend API client handles JWT refresh automatically on 401
- Database migrations tracked via Alembic (`backend/db/migrations/versions/`)
