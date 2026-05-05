# Refresh Token Hardening Plan

Status: Draft for Review
Updated: 2026-05-06

This ExecPlan is a living document. The sections Progress, Surprises &
Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date
as work proceeds.

Product spec: `docs/product-specs/2026-05-06-refresh-token-hardening.md`
Design doc: `docs/design-docs/refresh-token-hardening.md`
Task checklist: `docs/exec-plans/active/refresh-token-hardening-tasks.md`

## Purpose / Big Picture

Refresh tokens should be single-use. The backend should detect refresh-token
reuse, revoke the affected token family, and invalidate access tokens minted from
the compromised session path.

The visible API response shape remains unchanged, but the backend gains
persistent refresh-token state and stricter security behavior.

## Progress

- [x] (2026-05-06) Create product spec, design doc, execution plan, and task checklist.
- [ ] Add failing backend tests for refresh-token rotation and reuse detection.
- [ ] Add refresh-token persistence model, repository, and migration.
- [ ] Add `jti` and `family_id` claims to refresh JWT creation.
- [ ] Wire token issuing and refresh consumption through persisted state.
- [ ] Update logout to revoke stored refresh-token sessions.
- [ ] Run backend and documentation hard gates.
- [ ] Archive the completed plan and task checklist.

## Surprises & Discoveries

- Current `AuthService.issue_token()` is synchronous and cannot persist refresh
  token state. Implementation will need an async issue path or a small service
  split so login/register/SSO/LDAP flows can create stored refresh-token rows.
- Current logout already increments `jwt_token_version`; refresh-token session
  revocation should supplement that behavior rather than replace it.

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

Not started. This plan is ready for review before implementation.

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
