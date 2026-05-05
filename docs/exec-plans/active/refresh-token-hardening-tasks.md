# Refresh Token Hardening Tasks

Status: Draft for Review
Updated: 2026-05-06

## Checklist

- [x] Create spec, design doc, active plan, and task checklist.
- [ ] Write failing tests in `tests/test_refresh_token_rotation.py` for single-use refresh rotation.
- [ ] Write failing tests for reuse detection revoking the token family and current JWT version.
- [ ] Write failing tests for legacy refresh token rejection.
- [ ] Write failing tests for logout revoking stored refresh-token sessions.
- [ ] Create `backend/models/refresh_token.py`.
- [ ] Create `backend/repositories/refresh_token.py`.
- [ ] Add Alembic migration for refresh-token session persistence.
- [ ] Extend `backend/core/security/jwt_utils.py` refresh token claims with `jti` and `family_id`.
- [ ] Refactor `backend/services/auth.py` token issuing so refresh-token rows are persisted.
- [ ] Update login/register/SSO/LDAP flows in `backend/api/v1/auth.py` as needed for async persisted token issuing.
- [ ] Implement atomic refresh-token consumption and replacement.
- [ ] Implement reuse detection and family/user JWT revocation.
- [ ] Update logout to revoke stored refresh-token sessions.
- [ ] Add audit event coverage for refresh-token reuse when `ENABLE_AUDIT_LOG` is enabled.
- [ ] Run focused tests:
  `uv run pytest tests/test_refresh_token_rotation.py tests/test_api_auth.py -v`.
- [ ] Run full backend/docs gates:
  `uv run pytest`, `uv run ruff check .`, `uv run mypy backend`,
  `python scripts/validate_agents_docs.py --level ERROR`.
- [ ] Update `docs/exec-plans/tech-debt-tracker.md` after implementation status changes.
- [ ] Archive this plan and checklist into `docs/exec-plans/completed/`.

## Notes

- Follow TDD: write the failing behavior test before production code.
- Preserve the existing token-pair JSON response shape.
- Do not store raw refresh tokens.
- Reject legacy stateless refresh tokens after this hardening lands.
