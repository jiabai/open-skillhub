# AGENTS.md — Backend

Guidance for AI coding agents working with the **backend** Python FastAPI application. For project-wide context, see the root [AGENTS.md](../AGENTS.md).

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Python 3.10+ |
| Framework | FastAPI (async) |
| ORM | SQLAlchemy 2.0 (async, `mapped_column` style) |
| Validation | Pydantic v2 (`BaseModel`, `BaseSettings`) |
| Migrations | Alembic (async engine) |
| Auth | JWT (PyJWT) + bcrypt, OIDC/PKCE SSO, LDAP |
| Logging | Loguru (JSON or text, timezone-aware) |
| Packaging | UV (`uv sync --frozen`) |

## Directory Structure

```
backend/
  __init__.py             # Package version (0.1.2)
  api_app.py              # FastAPI app factory (create_application)
  main.py                 # CLI entry point (standalone MCP mode)
  alembic.ini             # Alembic config (URL set dynamically in env.py)
  Dockerfile              # Multi-stage UV build, runs as non-root user
  .env.example            # 140-line environment variable template

  api/                    # HTTP route layer
    router.py             #   Central router: registers all v1 sub-routers
    deps.py               #   Shared FastAPI dependencies (get_db_session, CurrentUser)
    v1/                   #   REST API v1 routes (all under /api/v1/)
      auth.py             #     /auth — OTP register/login, SSO, LDAP, refresh, logout
      skills.py           #     /skills — CRUD, upload, activate/deactivate, versions
      skills_support.py   #     Shared skill helpers (serialize, rate limit, audit, download)
      client_skills.py    #     /client/skills — API-token-only download endpoint
      tokens.py           #     /tokens — API token CRUD
      users.py            #     /users — profile, admin user management, identity updates
      dashboard.py        #     /dashboard — overview metrics, metrics cleanup
      audit.py            #     /audit — audit log query and export (admin-only)
      runtime_config.py   #     /runtime-config — feature flags for frontend
    mcp/                  #   MCP protocol handlers (reserved, currently empty)

  config/
    settings.py           # Pydantic BaseSettings (~280 lines), all env vars + validators

  core/                   # Cross-cutting concerns
    deps.py               #   FastAPI dependency factories for RBAC permission checks
    permissions.py        #   Centralized permission constants (Permission class)
    decorators/
      deprecation.py      #   @deprecated decorator for API sunset headers
    middleware/
      auth.py             #   get_current_user, get_current_active_user
      deprecation.py      #   Pure ASGI DeprecationMiddleware (Sunset headers)
      logging.py          #   RequestLoggingMiddleware, Loguru config
      rate_limit.py       #   In-memory per-IP rate limiting
    security/
      jwt_utils.py        #   create_access_token, create_refresh_token, decode_token
      password.py         #   bcrypt hash/verify (passlib + 72-byte truncation fix)
      rbac.py             #   has_permission, is_skill_visible
      token.py            #   API token generation (ask_live_...), SHA-256 hashing
      user_state.py       #   Backward-compatible shim → backend.domain.user_status
    metrics/
      tool_call_metrics.py #  record_tool_call — hourly metric aggregation
    tools/                #   MCP tool implementations (reserved, currently empty)
    utils/
      command_whitelist.py #  Command validation for sandboxed execution
      execution_control.py #  Concurrency slots, workdir quota, output truncation
      key_derivation.py   #  HKDF-SHA256 key derivation for AES-256
      process_exec.py     #  shlex helpers for command splitting
      service_runner.py   #  SkillHubMcpServiceRunner — subprocess lifecycle manager
      skill_archive.py    #  Archive save/load/delete (local + S3), AES-GCM encryption
      skill_storage.py    #  File system operations for skill dirs, validation
      user_context.py     #  ContextVar-based current user ID tracking

  db/
    session.py            #   Async engine + session factory, init_db
    migrations/
      env.py              #   Alembic env: async online migration runner
      versions/           #   14 migration files (initial → sso_auth_requests)

  domain/
    user_status.py        #   User status enum, validation, assert_user_active
    user-statuses.json    #   Status catalog: active/inactive/pending with labels

  models/                 # SQLAlchemy ORM models (all inherit Base + UUIDPrimaryKeyMixin + TimestampMixin)
    base.py               #   Base, TimestampMixin, UUIDPrimaryKeyMixin, generate_uuid
    user.py               #   User — email, username, role, status, enterprise_id, team_id, jwt_token_version
    skill.py              #   Skill — name, description, tags, visibility, source_skill_id, cloned_from_*
    skill_version.py      #   SkillVersion — version, dependencies, dependency_spec, metadata
    token.py              #   APIToken — name, token_hash, expires_at, last_used_at
    audit_log.py          #   AuditLog — actor_id, action, target, result, ip, user_agent, details
    request_metric.py     #   RequestMetric — user_id, bucket_start, total/success/failure counts
    verification_code.py  #   VerificationCode — email, purpose, code_hash, expires_at, attempts
    email_delivery_log.py #   EmailDeliveryLog — email, purpose, channel, status, attempts
    enterprise.py         #   Enterprise — external_id, name, status
    team.py               #   Team — external_id, enterprise_id, name, status
    sso_auth_request.py   #   SSOAuthRequest — state_hash, nonce_hash, code_verifier, redirect_uri
    sso_nonce.py          #   SSONonce — nonce_hash, purpose, expires_at, used_at
    sso_replay_token.py   #   SSOReplayToken — replay_key_hash, purpose, expires_at

  repositories/           # Data access layer (one repo per model, extends BaseRepository)
    base.py               #   BaseRepository — get, get_multi, count, create, update, delete
    user.py               #   UserRepository — get_by_email, get_by_username, get_by_id, list_users
    skill.py              #   SkillRepository — complex visibility queries, reference/clone tracking
    skill_version.py      #   SkillVersionRepository — version CRUD, get_by_version
    token.py              #   TokenRepository — list_by_user, count_by_user, count_available_by_user
    audit_log.py          #   AuditLogRepository — list with filters, aggregate
    request_metric.py     #   RequestMetricRepository — upsert_hour_bucket, aggregate_window, cleanup
    enterprise.py         #   EnterpriseRepository
    team.py               #   TeamRepository

  schemas/                # Pydantic v2 DTOs
    auth.py               #   LDAPLoginRequest, UserIdentityUpdate
    user.py               #   UserCreate, UserLogin, UserRegisterCode, UserLoginCode, UserBindEmail, UserUpdate, UserResponse
    skill.py              #   SkillCreate, SkillUpdate, SkillConsoleResponse, PublicSkillResponse, SkillReferenceCreate, SkillCloneCreate
    skill_download.py     #   SkillDownloadRequest, SkillDownloadResponse
    skill_lifecycle.py    #   SkillInstallInstructionsResponse, SkillVersionDiffResponse
    skill_version.py      #   SkillVersionResponse, SkillVersionListResponse
    token.py              #   TokenCreate, TokenResponse, TokenRefresh, TokenListResponse
    response.py           #   ErrorResponse, PaginatedResponse, TokenPair, DashboardOverviewResponse
    runtime_config.py     #   RuntimeCapabilities, RuntimeConfigResponse
    audit.py              #   AuditLogItem, AuditLogListResponse, AuditLogExportRequest, AuditLogExportResponse
    metrics.py            #   MetricsCleanupRequest, MetricsCleanupResponse
    metrics_reset.py      #   MetricsReset24hResponse
    verification.py       #   VerificationCodeRequest, VerificationCodeResponse

  services/               # Business logic layer
    auth.py               #   AuthService — register, login_ldap, login_sso, login_sso_claims, refresh_token, issue_token
    skill.py              #   SkillService — full skill lifecycle (45+ KB, largest file)
    skill_clone.py        #   Skill clone logic
    skill_download.py     #   SkillDownloadService — archive + encrypt + checksum payload builder
    skill_errors.py       #   SkillErrorCode enum, SkillError, DownloadTooLargeError
    skill_support.py      #   Skill support helpers
    token.py              #   TokenService — create, validate, revoke API tokens
    user.py               #   UserService — update_user, delete_user
    audit.py              #   AuditService — create_event, list_events, export_csv/json
    email_sender.py       #   Email sending (SMTP + Aliyun DM)
    verification_code.py  #   Verification code send/verify logic
    sso_oidc.py           #   SSOOIDCService — OIDC Authorization Code + PKCE flow
    sso_replay_guard.py   #   SSOReplayGuardService — nonce/replay token tracking
    runtime_config.py     #   RuntimeConfigService — build capabilities from settings
    deprecation_notification.py # DeprecationNotifier — scheduled deprecation alerts

  scripts/
    init-db.sql           #   PostgreSQL manual init script
    sync_public_skills.py #   Sync filesystem skill dirs → database
```

## Architecture

### Request Flow

```
Request → Middleware Stack (CORS → Logging → Rate Limit → Deprecation)
        → API Router (/api/v1/...)
        → Dependency Injection (auth, permissions, DB session)
        → Route Handler
        → Service (business logic)
        → Repository (data access)
        → SQLAlchemy AsyncSession → Database
```

### App Bootstrap (`api_app.py`)

The `create_application()` factory:
1. Configures Loguru via `configure_loguru()`
2. Creates FastAPI with `lifespan` (runs `init_db` + optional deprecation notifier on startup)
3. Registers middleware stack: CORS → RequestLogging → RateLimit → Deprecation
4. Includes API router at `/api/v1` prefix
5. Registers operational endpoints: `/livez`, `/readyz`, `/health`, `/metrics`
6. Adds request size middleware for skill download endpoint
7. Registers exception handlers (HTTPException → consistent `{"detail", "code", "timestamp"}` shape)

### API Router (`api/router.py`)

All v1 routes are registered with prefix and tag:

| Prefix | Tag | Module |
|--------|-----|--------|
| `/auth` | auth | `auth.py` |
| `/audit` | audit | `audit.py` |
| `/dashboard` | dashboard | `dashboard.py` |
| `/runtime-config` | runtime-config | `runtime_config.py` |
| `/users` | users | `users.py` |
| `/tokens` | tokens | `tokens.py` |
| `/skills` | skills | `skills.py` |
| `/client/skills` | client-skills | `client_skills.py` |

### Authentication & Authorization

Three auth methods, all producing JWT access (30 min) + refresh (7 days) tokens:

1. **Email OTP**: `POST /auth/verification-code` → `POST /auth/login` or `POST /auth/register`
2. **SSO (OIDC + PKCE)**: `GET /auth/sso/authorize` → `GET /auth/sso/callback`
3. **LDAP**: `POST /auth/ldap/login`

API tokens (`ask_live_...`) are used for MCP/client endpoints, validated via `get_current_api_token_user` in `core/deps.py`.

**Logout** increments `user.jwt_token_version`, invalidating all previously issued JWTs.

### Permission System (`core/permissions.py` + `core/deps.py`)

- `Permission` class defines all permission strings (e.g., `skill.list`, `skill.download`)
- `require_permission("skill.list")` returns a FastAPI `Depends` that checks RBAC
- `require_management_access()` — admin-only endpoints, blocked when RBAC is disabled
- `require_skill_download_access()` — RBAC-aware download authorization
- When `ENABLE_RBAC=false`, all permission checks pass (open access)

### Error Handling

All errors follow a consistent JSON shape:
```json
{
  "detail": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

Skill-specific errors use `SkillError` with `SkillErrorCode` enum and are translated to HTTP status codes via `handle_skill_value_error()` in `skills_support.py`.

### Settings & Feature Flags

`config/settings.py` defines ~90 environment variables. Key groups:

| Group | Key Flags |
|-------|----------|
| Database | `DATABASE_URL`, pool settings |
| Security | `SECRET_KEY` (>= 32 chars), `ALGORITHM`, token expiry |
| Auth | `ENABLE_EMAIL_OTP_LOGIN`, `ENABLE_SSO`, `ENABLE_LDAP`, `ENABLE_PUBLIC_SIGNUP` |
| Org/RBAC | `ENABLE_ORG_MODEL`, `ENABLE_RBAC`, `ENABLE_SKILL_VISIBILITY` |
| Audit | `ENABLE_AUDIT_LOG`, `ENABLE_AUDIT_EXPORT` |
| Skill Storage | `SKILL_STORAGE_PATH`, `SKILL_ARCHIVE_BACKEND` (local/s3) |
| Encryption | `ENABLE_SKILL_DOWNLOAD_ENCRYPTION`, `ENABLE_LOCAL_CACHE_ENCRYPTION` |
| Sandbox | `ENABLE_SANDBOX_EXECUTION`, `ENABLE_NETWORK_EGRESS_CONTROL` |
| Rate Limit | `ENABLE_RATE_LIMIT`, `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW` |
| Metrics | `ENABLE_METRICS`, `METRICS_RETENTION_DAYS` |

Validators enforce production safety: `SECRET_KEY` minimum length, no wildcard CORS in production, pool size bounds.

### Database Sessions

`db/session.py`:
- SQLite: simple engine (no pooling)
- PostgreSQL: engine with `pool_size`, `max_overflow`, `pool_timeout`, `pool_recycle`
- All sessions use `async_sessionmaker` with `expire_on_commit=False`

### Skill File System

Skills are stored at `{SKILL_STORAGE_PATH}/{owner_id}/{skill_name}/`:
- Current files at the skill dir root
- Versioned files under `_versions/{version}/`
- Archives at `_archives/{owner_id}/{skill_name}/{version}.zip`
- Local cache at `_local_cache/{owner_id}/{skill_name}/{version}.cache`

File validation: allowed extensions, safe filename pattern, max file size (10 MB), max total size (100 MB), max 50 files per skill.

### S3 Archive Backend

When `SKILL_ARCHIVE_BACKEND=s3`, archives are stored in S3 with local cache fallback (`ENABLE_CACHE_OFFLINE_FALLBACK`). Encryption uses AES-256-GCM via `cryptography` with HKDF-derived keys.

## Conventions

### Code Style

- **async everywhere**: all database I/O, service methods, and route handlers are async
- **Type hints**: use Python 3.10+ union syntax (`str | None` instead of `Optional[str]`)
- **SQLAlchemy 2.0 style**: `Mapped[str]`, `mapped_column()`, no legacy `Column()`
- **Pydantic v2**: `model_config = {"from_attributes": True}`, `Field()`, `field_validator`

### Naming Patterns

| Layer | Pattern | Example |
|-------|---------|---------|
| Model | `{Entity}` | `User`, `Skill`, `APIToken` |
| Repository | `{Entity}Repository` | `UserRepository`, `SkillRepository` |
| Service | `{Domain}Service` | `AuthService`, `SkillService` |
| Schema (Create) | `{Entity}Create` | `SkillCreate`, `TokenCreate` |
| Schema (Update) | `{Entity}Update` | `SkillUpdate`, `UserUpdate` |
| Schema (Response) | `{Entity}Response` | `UserResponse`, `SkillConsoleResponse` |
| Schema (List) | `{Entity}ListResponse` | `SkillListResponse`, `TokenListResponse` |
| MCP tool op | `{verb}_OP` | `load_skill_OP` |
| Permission | `{domain}.{action}` | `skill.list`, `user.manage` |

### Import Order

1. Standard library
2. Third-party (fastapi, sqlalchemy, pydantic, etc.)
3. Local application (`backend.*`)

### Dependency Injection

- DB session: `session = Depends(get_async_session)`
- Current user: `current_user = Depends(get_current_active_user)`
- Permission: `current_user = Depends(require_permission("skill.list"))`
- Management: `current_user = Depends(require_management_access())`
- API token user: `current_user = Depends(get_current_api_token_user)`

### Testing Conventions

- Tests live in top-level `tests/` directory (not inside `backend/`)
- `conftest.py` provides: in-memory SQLite, deterministic verification codes ("123456"), all feature flags enabled
- Each test gets a clean database via `reset_database` fixture (autouse)
- Use `httpx.AsyncClient` with `ASGITransport` for integration tests

## Common Tasks

### Adding a New API Endpoint

1. Define request/response schemas in `backend/schemas/`
2. Add route handler in `backend/api/v1/` (create new file if new domain, or extend existing)
3. If new file, register router in `backend/api/router.py`
4. Implement business logic in `backend/services/`
5. Add repository methods in `backend/repositories/` if DB access needed
6. Add permission constant in `backend/core/permissions.py` if new permission needed
7. Add dependency in `backend/core/deps.py` if new auth pattern needed
8. Add tests in `tests/`
9. Update Alembic migration if schema changed

### Adding a New Database Model

1. Create model file in `backend/models/` — inherit `UUIDPrimaryKeyMixin`, `TimestampMixin`, `Base`
2. Import and add to `backend/models/__init__.py`
3. Create repository in `backend/repositories/` — extend `BaseRepository`
4. Import and add to `backend/repositories/__init__.py`
5. Generate migration: `alembic revision --autogenerate -m "add_{model_name}"`
6. Review and edit the generated migration
7. Test: `alembic upgrade head` then `pytest`

### Adding a New Feature Flag

1. Add boolean field to `Settings` class in `backend/config/settings.py` with `ENABLE_` prefix
2. Add to `.env.example` with default value and comment
3. Expose via `RuntimeConfigService.build_capabilities()` in `backend/services/runtime_config.py`
4. Add to `RuntimeCapabilities` schema in `backend/schemas/runtime_config.py`
5. Check flag in service/middleware code: `if not settings.ENABLE_X: raise HTTPException(403, ...)`
6. Update test fixture in `tests/conftest.py`

### Modifying Settings

1. Add field to `Settings` class in `backend/config/settings.py`
2. Add validator if needed (`@field_validator` or `@model_validator`)
3. Update `.env.example` with description and default
4. Settings are auto-validated on startup by Pydantic

### Working with Skill Archives

- Local backend: archives saved to `_archives/` directory
- S3 backend: archives uploaded to S3 bucket, local cache in `_local_cache/`
- Encryption: AES-256-GCM with HKDF-derived keys from `SECRET_KEY`
- Download flow: load archive → encrypt (if enabled) → base64 encode → return with checksum

## Important Notes

- Never commit `.env` files — they are gitignored; use `.env.example` as template
- All model PKs are UUID strings (36 chars), generated by `generate_uuid()`
- `api/mcp/` and `core/tools/` directories exist but are currently empty (reserved for MCP tool implementations)
- The `SkillService` in `services/skill.py` is the largest file (~46 KB) — handles full skill lifecycle
- `domain/user_status.py` is the single source of truth for user status; `core/security/user_state.py` is a backward-compatible shim
- Alembic `env.py` reads `DATABASE_URL` from settings dynamically, not from `alembic.ini`
- Docker runs as non-root user `skillhub`, data dir at `/app/data`
- UV lockfile (`uv.lock`) at project root ensures deterministic builds
- `SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"` is the reserved ID for public skills
- Rate limiting is in-memory (per-process) — not suitable for multi-worker production without external store
