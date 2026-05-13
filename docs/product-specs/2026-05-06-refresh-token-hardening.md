# Refresh Token Hardening

## Background

SkillDrive web sessions currently use JWT access tokens and JWT refresh
tokens. Refresh tokens are re-issued on `/api/v1/auth/refresh`, but the backend
does not keep per-refresh-token state. That means an old refresh token remains
usable until it expires, unless the user's global `jwt_token_version` changes.

This spec turns the high-priority security debt into a reviewable product and
security boundary before implementation.

## Goal

Make refresh tokens single-use and detect refresh-token reuse so leaked refresh
tokens cannot silently keep extending a session.

## User-Visible Behavior

1. Normal login, registration, SSO, LDAP login, and refresh still return the same
   response shape:

   ```json
   {
     "access_token": "...",
     "refresh_token": "..."
   }
   ```

2. A client must replace its stored refresh token with the newest refresh token
   after every successful refresh.
3. Reusing an old refresh token returns `401`.
4. When reuse is detected, the affected token family is revoked. For the first
   implementation batch, reuse should also revoke the user's current JWT version
   to invalidate access tokens that may have been minted from the compromised
   family.
5. Existing pre-hardening refresh tokens may require users to sign in again after
   deployment. This is acceptable for the security upgrade and should be called
   out in release notes.

## Scope

- Add backend persistence for refresh-token sessions/families.
- Add unique token IDs (`jti`) and family IDs to newly issued refresh tokens.
- Store only hashed refresh-token material, never raw refresh tokens.
- Make `/api/v1/auth/refresh` consume the presented refresh token exactly once.
- Rotate refresh tokens by marking the presented token used and issuing a new
  active token in the same family.
- Detect reuse of a used/revoked token and revoke the family.
- Keep `/api/v1/auth/logout` revoking all JWTs for the current user and mark
  stored refresh-token sessions revoked.
- Add backend tests for normal refresh, old-token reuse, family revocation,
  legacy-token rejection, logout, and inactive/deleted user handling.

## Non-Goals

- Do not change the frontend token storage mechanism in this batch.
- Do not introduce device/session management UI.
- Do not add long-lived "remember this device" behavior.
- Do not change API token behavior; this spec only covers web-session JWT refresh
  tokens.
- Do not support a grace window where two refresh requests can both succeed with
  the same refresh token.

## Affected Surfaces

| Surface | Expected impact |
|---------|-----------------|
| `POST /api/v1/auth/refresh` | Same response shape; stricter rejection of old or reused refresh tokens |
| `POST /api/v1/auth/logout` | Existing token-version revocation remains; stored refresh-token rows are also revoked |
| Login/register/SSO/LDAP login | Same response shape; new refresh token state is created server-side |
| Backend database | New table for refresh token state and family tracking |
| Audit log | Existing refresh failure audit remains; reuse detection should emit an explicit audit event when audit logging is enabled |

## Acceptance Criteria

- A refresh token can be used once and only once.
- The new refresh token returned by a successful refresh can be used for the next
  refresh.
- Reusing the old token after rotation returns `401`.
- Reuse detection revokes the token family and invalidates access tokens minted
  for the user through the current JWT version mechanism.
- Raw refresh tokens are not stored in the database.
- Legacy refresh tokens without the new state claims are rejected with `401`.
- Logout revokes outstanding stored refresh-token sessions for the user.
- Full backend hard gates pass:

  ```bash
  uv run pytest
  uv run ruff check .
  uv run mypy backend
  python scripts/validate_agents_docs.py --level ERROR
  ```

## References

- `docs/SECURITY.md`
- `docs/design-docs/2026-04-12-code-review-findings.md`
- `docs/design-docs/refresh-token-hardening.md`
- `docs/exec-plans/completed/refresh-token-hardening-plan.md`
