# Refresh Token Hardening Design

## Status

Proposed for implementation.

## Problem

The current refresh flow validates JWT signature, token type, user existence,
user enabled state, and `jwt_token_version`. It does not persist refresh-token
state, so a previously used refresh token can be replayed until it naturally
expires or all JWTs are revoked for the user.

## Decision

Use stateful refresh-token rotation with token families:

- Every refresh token has a random `jti` and random `family_id`.
- The raw refresh token is never stored.
- The backend stores a one-way hash of the raw refresh token plus metadata needed
  to identify user, family, expiry, and status.
- Refresh consumes the presented token in a database transaction, marks it used,
  creates the replacement token row, and returns the replacement token pair.
- Reuse of a used/revoked token marks the family compromised and increments the
  user's `jwt_token_version`.

## Proposed Data Model

Create a new SQLAlchemy model, for example `RefreshTokenSession`, with an Alembic
migration.

| Field | Purpose |
|-------|---------|
| `id` | UUID primary key |
| `user_id` | FK to `users.id`, cascade delete |
| `family_id` | Random ID shared by all rotations in one login session |
| `jti` | Random token ID claim for diagnostics and uniqueness |
| `token_hash` | SHA-256 or HMAC-SHA-256 hash of the raw refresh token |
| `status` | `active`, `used`, `revoked`, or `compromised` |
| `expires_at` | Expiry copied from the JWT `exp` |
| `used_at` | Set when a token is consumed successfully |
| `revoked_at` | Set when logout, reuse, or user-level revocation invalidates it |
| `replaced_by_jti` | Replacement token ID after successful rotation |
| `created_at`, `updated_at` | Existing timestamp mixin pattern |

Indexes should support:

- `token_hash` unique lookup.
- `user_id` cleanup/revocation.
- `family_id` family revocation.
- `expires_at` cleanup.

## Refresh Flow

1. Decode the submitted JWT using existing `decode_token()`.
2. Require `type=refresh`, `sub`, `jti`, `family_id`, `exp`, and matching `ver`.
3. Hash the raw submitted token and load the stored token row.
4. Reject unknown or expired token state.
5. If the row is `used`, `revoked`, or `compromised`, mark the family compromised,
   increment `user.jwt_token_version`, write an audit event, and return `401`.
6. If the row is `active`, mark it `used`, create a replacement refresh token row
   in the same family, and return a new access/refresh pair.
7. Commit token state changes atomically before returning the response.

## Login And Logout Flow

- Login, registration, SSO, and LDAP login create a new token family.
- Logout keeps the current behavior of incrementing `jwt_token_version` and also
  marks all stored refresh-token rows for the user as revoked.
- User deletion relies on cascade delete for refresh-token rows.

## Legacy Token Policy

Refresh tokens without `jti` or `family_id` are rejected after this migration. The
security benefit is stronger than keeping invisible compatibility for old tokens.
Users with legacy refresh tokens can sign in again.

## Error And Audit Semantics

- Invalid, missing, expired, or legacy refresh tokens return `401`.
- Reuse detection should use a distinct internal/audit reason such as
  `REFRESH_TOKEN_REUSE_DETECTED`.
- When `ENABLE_AUDIT_LOG` is enabled, reuse detection should emit
  `auth.refresh.reuse_detected`.
- The public API response does not need to reveal whether a token was reused,
  missing, expired, or revoked.

## Trade-Offs

| Choice | Benefit | Cost |
|--------|---------|------|
| Stateful refresh tokens | Enables single-use rotation and reuse detection | Adds a table, repository, and cleanup need |
| Revoke user JWT version on reuse | Contains access tokens minted from a compromised family | Logs out all active sessions for that user |
| Reject legacy refresh tokens | Simple and secure migration behavior | Some users must sign in again after deploy |
| Store raw-token hash | Avoids storing bearer secrets | Requires hashing before lookup and careful test fixtures |

## Future Follow-Ups

- Add user-facing session/device management UI.
- Add scheduled cleanup for expired refresh-token rows.
- Consider per-family access-token versioning if the project later needs
  session-specific compromise handling instead of user-wide revocation.
