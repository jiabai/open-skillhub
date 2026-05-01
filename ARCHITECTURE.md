# ARCHITECTURE

Open SkillHub is a private skill management and distribution platform for AI agents.

## Overview

The repository combines a FastAPI backend, a Next.js web console, and an Electron desktop client around one core job: store versioned skills per user, manage access to them, and distribute them safely to client runtimes.

Most day-to-day product work happens in `backend/`, `frontend/`, and `tests/`. Shared documentation lives in `docs/`, and deployment assets live in `deploy/`.

## Code Map

### Module Breakdown

| Module | Path | Responsibility |
|------|------|------|
| Backend API | `backend/api/` | HTTP routes, request parsing, auth dependencies, runtime config and operational endpoints |
| Backend services | `backend/services/` | Business logic for auth, skills, tokens, audit, email, SSO, and runtime capabilities |
| Backend persistence | `backend/repositories/`, `backend/models/`, `backend/db/` | Data access, ORM models, session management, and Alembic migrations |
| Backend cross-cutting | `backend/core/`, `backend/config/`, `backend/domain/` | Middleware, security, permissions, feature flags, and shared domain rules |
| Frontend app | `frontend/src/app/` | Next.js routes and page-level UI |
| Frontend shared UI | `frontend/src/components/`, `frontend/src/hooks/`, `frontend/src/i18n/` | Application shell, reusable components, hooks, and localization |
| Frontend client runtime | `frontend/src/lib/`, `frontend/src/types/` | API client, navigation, runtime-config store, and shared TypeScript types |
| Desktop client | `desktop-client/` | Electron renderer, main process, sync/distribution workflow |
| Shared assets | `shared/` | Shared JSON data consumed by backend and frontend |
| Tests | `tests/`, `frontend/src/__tests__/` | Backend integration/unit coverage and frontend component tests |
| Project docs | `docs/` | Design docs, specs, execution plans, deployment guides, and operational references |

### Module Relationships

The main product path is:

`Browser or API client -> frontend or backend route -> service -> repository -> database or filesystem`

For the web console, the frontend talks to backend HTTP endpoints and adapts its UI from the backend runtime capability contract. For machine clients, API tokens authorize direct backend calls for client-scoped skill metadata, upload, and download workflows.

## Architectural Invariants

- Backend request handling follows `route -> service -> repository`. Business logic does not skip directly from routes to SQL.
- Runtime feature capability truth lives in the backend. The frontend reads `/api/v1/runtime-config` instead of inventing its own feature flags.
- Skill storage is user-scoped. Filesystem layout and API auth both enforce per-user isolation.
- ORM models use UUID primary keys and async SQLAlchemy access patterns.
- Project knowledge should be discoverable from the repository. Stable maps live in `AGENTS.md` files; deeper details live in `docs/`.

## Layer Boundaries

- API boundary: `backend/api/` validates requests, chooses dependencies, and formats responses.
- Service boundary: `backend/services/` owns workflow rules, capability derivation, and side effects.
- Repository boundary: `backend/repositories/` owns database querying and persistence details.
- Frontend boundary: `frontend/src/lib/api.ts` is the shared backend access layer; pages and components should not bypass it with ad hoc fetch logic.
- Documentation boundary: `AGENTS.md` files stay short and stable; active work details belong in specs and exec plans.

## Cross-Cutting Concerns

- Authentication and authorization are centered in backend middleware, security helpers, and dependency factories.
- Runtime configuration is built once in the backend and propagated to the frontend through a provider.
- Audit logging, rate limiting, and deprecation handling are backend middleware or services rather than page-level concerns.
- Internationalization is centralized in `frontend/src/i18n/`.
- Deployment assumptions and reverse-proxy behavior are documented under `docs/` and `deploy/nginx/`.

## Key Files

- `backend/api_app.py` - FastAPI app factory, middleware, operational endpoints, exception shaping
- `backend/api/router.py` - top-level REST router registration
- `backend/config/settings.py` - validated environment-backed configuration
- `backend/services/skill.py` - largest backend workflow surface for skill lifecycle logic
- `frontend/src/app/layout.tsx` - frontend root providers and shell composition
- `frontend/src/lib/api.ts` - shared browser API client and token refresh logic
- `frontend/src/lib/runtime-config.ts` - frontend runtime capability store
- `docker-compose.yml` - default local deployment topology

## Extended Reading

- `docs/DESIGN.md`
- `docs/SECURITY.md`
- `docs/design-docs/index.md`
- `docs/product-specs/index.md`
- `docs/exec-plans/index.md`
