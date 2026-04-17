# Database Schema Snapshot

Last updated: 2026-04-17

## Purpose

This file is a lightweight, agent-friendly summary of the current backend relational model. It is not a migration history and it is not a substitute for reading Alembic revisions.

## Core Tables

| Table | Main purpose |
|------|--------------|
| `users` | Web identities, auth-related status, org references, and JWT invalidation version |
| `api_tokens` | API tokens issued for programmatic clients |
| `skills` | Skill metadata, ownership, visibility, storage path, and self-reference metadata |
| `skill_versions` | Versioned snapshots and dependency metadata per skill |
| `audit_logs` | Audit trail for user or system actions |
| `request_metrics` | Hourly aggregate request metrics |
| `verification_codes` | Email OTP and related verification state |
| `email_delivery_logs` | Delivery attempts for outbound email |
| `enterprises` | Optional organization model root |
| `teams` | Optional organization model child entity |
| `sso_auth_requests` | OIDC authorization flow state and PKCE material |
| `sso_nonces` | SSO nonce tracking |
| `sso_replay_tokens` | Replay-protection records for SSO flows |

## Important Relationships

- `users` -> `api_tokens`: one-to-many
- `users` -> `skills`: one-to-many
- `skills` -> `skill_versions`: one-to-many
- `skills` -> `skills`: optional self-references for source and clone provenance

## Notes

- The default development database is SQLite; production can use PostgreSQL.
- All major tables use UUID string primary keys through shared model mixins.
- For exact columns and constraints, inspect `backend/models/` and Alembic revisions in `backend/db/migrations/versions/`.
