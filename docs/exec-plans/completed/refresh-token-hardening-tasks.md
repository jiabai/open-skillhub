# Refresh Token Hardening Tasks

Status: Completed
Updated: 2026-05-13

## Checklist

- [x] Create spec, design doc, active plan, and task checklist.
- [x] Write failing tests in `tests/test_refresh_token_rotation.py` for single-use refresh rotation.
- [x] Write failing tests for reuse detection revoking the token family and current JWT version.
- [x] Write failing tests for legacy refresh token rejection.
- [x] Write tests for logout revoking stored refresh-token sessions.
- [x] Create `backend/models/refresh_token.py`.
- [x] Create `backend/repositories/refresh_token.py`.
- [x] Add Alembic migration for refresh-token session persistence.
- [x] Extend `backend/core/security/jwt_utils.py` refresh token claims with `jti` and `family_id`.
- [x] Refactor `backend/services/auth.py` token issuing so refresh-token rows are persisted.
- [x] Update login/register/SSO/LDAP flows in `backend/api/v1/auth.py` as needed for async persisted token issuing.
- [x] Implement atomic refresh-token consumption and replacement.
- [x] Implement reuse detection and family/user JWT revocation.
- [x] Update logout to revoke stored refresh-token sessions.
- [x] Add audit event coverage for refresh-token reuse when `ENABLE_AUDIT_LOG` is enabled.
- [x] Run focused tests:
  `uv run pytest tests/test_refresh_token_rotation.py tests/test_api_auth.py -v`.
- [x] Run full backend/docs gates:
  `uv run pytest`, `uv run ruff check .`, `uv run mypy backend`,
  `python scripts/validate_agents_docs.py --level ERROR`.
- [x] Update `docs/exec-plans/tech-debt-tracker.md` after implementation status changes.
- [x] Archive this plan and checklist into `docs/exec-plans/completed/`.

## Notes

- Follow TDD: write the failing behavior test before production code.
- Preserve the existing token-pair JSON response shape.
- Do not store raw refresh tokens.
- Reject legacy stateless refresh tokens after this hardening lands.
