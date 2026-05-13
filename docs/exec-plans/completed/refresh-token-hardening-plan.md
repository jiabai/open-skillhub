# Refresh Token Hardening Plan

Status: Completed
Updated: 2026-05-13

This ExecPlan is a living document. The sections Progress, Surprises &
Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date
as work proceeds.

Product spec: `docs/product-specs/2026-05-06-refresh-token-hardening.md`
Design doc: `docs/design-docs/refresh-token-hardening.md`
Task checklist: `refresh-token-hardening-tasks.md`

## Purpose / Big Picture

Refresh tokens should be single-use. The backend should detect refresh-token
reuse, revoke the affected token family, and invalidate access tokens minted from
the compromised session path.

The visible API response shape remains unchanged, but the backend gains
persistent refresh-token state and stricter security behavior.

## Progress

- [x] (2026-05-06) Create product spec, design doc, execution plan, and task checklist.
- [x] (2026-05-13) Add failing backend tests for refresh-token rotation and reuse detection.
- [x] (2026-05-13) Add refresh-token persistence model, repository, and migration.
- [x] (2026-05-13) Add `jti` and `family_id` claims to refresh JWT creation.
- [x] (2026-05-13) Wire token issuing and refresh consumption through persisted state.
- [x] (2026-05-13) Update logout to revoke stored refresh-token sessions.
- [x] (2026-05-13) Run backend and documentation hard gates.
- [x] (2026-05-13) Archive the completed plan and task checklist.

## Surprises & Discoveries

- Current `AuthService.issue_token()` is synchronous and cannot persist refresh
  token state. Implementation will need an async issue path or a small service
  split so login/register/SSO/LDAP flows can create stored refresh-token rows.
- Current logout already increments `jwt_token_version`; refresh-token session
  revocation should supplement that behavior rather than replace it.
- `AuthService.issue_token()` remains as a synchronous compatibility helper for
  unit-level callers. API login/register/SSO/LDAP paths now use async persisted
  token issuing through `issue_token_pair()`.
- Local `uv run ...` commands failed in this Windows environment with
  `uv trampoline failed to canonicalize script path`; the same gates were run
  through `.venv\Scripts\python.exe -m ...`.

## Decision Log

- Decision: Reject legacy refresh tokens that do not carry `jti` and `family_id`.
  Rationale: Accepting old stateless refresh tokens would preserve the exact
  weakness this work is meant to remove.
  Date/Author: 2026-05-06 / Codex

- Decision: Treat refresh-token reuse as a user-wide JWT revocation event in the
  first implementation batch.
  Rationale: A stolen refresh token may have minted a fresh access token before
  reuse is detected. Incrementing `jwt_token_version` contains that risk using
  the mechanism the app already has.
  Date/Author: 2026-05-06 / Codex

## Outcomes & Retrospective

Implemented on 2026-05-13.

Outcomes:

- Added `backend/models/refresh_token.py`,
  `backend/repositories/refresh_token.py`, and Alembic revision
  `q2r3s4t5u6v7_add_refresh_token_sessions.py`.
- New refresh tokens carry `jti` and `family_id`; only HMAC-SHA-256 hashes of
  raw refresh tokens are stored.
- Login, registration, SSO, and LDAP routes create persisted refresh-token
  rows while preserving the existing token-pair JSON response shape.
- `/api/v1/auth/refresh` consumes active refresh rows once, creates a
  replacement row in the same family, rejects legacy tokens without rotation
  claims, and treats reused rows as compromise.
- Reuse detection revokes the family, increments `jwt_token_version`, and emits
  `auth.refresh.reuse_detected` when audit logging is enabled.
- Logout keeps user-wide JWT revocation and also marks stored refresh-token rows
  revoked.

Validation:

- `.\.venv\Scripts\python.exe -m pytest tests\test_refresh_token_rotation.py -q`
  passed: 5 tests.
- `.\.venv\Scripts\python.exe -m pytest tests\test_refresh_token_rotation.py tests\test_api_auth.py -q`
  passed: 23 tests.
- `.\.venv\Scripts\python.exe -m pytest tests\test_auth_service.py tests\test_auth_service_full.py tests\test_auth_service_sso_ldap.py tests\test_ldap_login.py tests\test_security_jwt.py -q`
  passed: 69 tests.
- `.\.venv\Scripts\python.exe -m pytest` passed: 660 tests.
- `.\.venv\Scripts\python.exe -m ruff check .` passed.
- `.\.venv\Scripts\python.exe -m mypy backend` passed.
- Temporary SQLite `alembic upgrade head` passed.
- `python scripts\validate_agents_docs.py --level ERROR` passed.

## Context and Orientation

Current anchors:

| File | Current role |
|------|--------------|
| `backend/services/auth.py` | Issues JWT pairs and refreshes submitted refresh tokens |
| `backend/api/v1/auth.py` | Exposes login/register/refresh/logout/SSO/LDAP routes and audit calls |
| `backend/core/security/jwt_utils.py` | Creates and decodes access/refresh JWTs |
| `backend/models/user.py` | Stores `jwt_token_version` used for global JWT revocation |
| `tests/test_api_auth.py` | Current auth API regression coverage |

New likely anchors:

| File | Expected role |
|------|---------------|
| `backend/models/refresh_token.py` | Persist refresh-token session/family state |
| `backend/repositories/refresh_token.py` | Encapsulate token lookup, rotation, family revocation, and cleanup queries |
| `backend/db/migrations/versions/<revision>_add_refresh_token_sessions.py` | Create refresh-token session table and indexes |
| `tests/test_refresh_token_rotation.py` | Focused single-use rotation and reuse detection tests |

## Plan of Work

### Phase 1: Failing Tests

Add tests first:

1. A newly issued refresh token can refresh once.
2. The old refresh token cannot refresh a second time.
3. Reusing the old refresh token revokes the family and invalidates the access
   token returned by the first refresh.
4. A legacy refresh token without `jti` / `family_id` is rejected.
5. Logout revokes outstanding stored refresh-token sessions.

### Phase 2: Persistence

Add the model, repository, and Alembic migration. Store only a hash of the raw
refresh token. Keep status values simple and local to backend auth code unless a
later plan introduces a shared catalog.

### Phase 3: Token Claims And Issuing

Extend refresh-token creation so every new refresh token includes `jti` and
`family_id`. Convert token-pair issuing to an async path that can persist refresh
state for login/register/SSO/LDAP flows.

### Phase 4: Rotation And Reuse Detection

Update `AuthService.refresh_token()` to consume the active token row, create the
replacement row, detect reuse, revoke the family, and increment
`jwt_token_version` on compromise.

### Phase 5: Logout And Audit

Keep logout's existing `jwt_token_version` revocation, add stored refresh-token
row revocation, and emit audit events for reuse detection when audit logging is
enabled.

### Phase 6: Validation And Archive

Run focused tests during implementation, then full backend/documentation gates
before archiving this plan and its tasks.

## Validation and Acceptance

Focused validation:

```bash
uv run pytest tests/test_refresh_token_rotation.py -v
uv run pytest tests/test_api_auth.py::test_logout_revokes_existing_access_and_refresh_tokens -v
```

Full backend/documentation gates:

```bash
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```

Acceptance:

- Old refresh tokens fail after one successful rotation.
- Refresh-token reuse is detected and invalidates the compromised user's current
  JWT version.
- No raw refresh tokens are persisted.
- Logout revokes stored refresh-token sessions.
- Existing login/register/SSO/LDAP response shapes remain unchanged.
