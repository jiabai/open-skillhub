# Auth Provider Consistency Plan

Status: Draft for Review
Updated: 2026-05-06

Design: `docs/design-docs/auth-provider-consistency.md`
Tasks: `docs/exec-plans/active/auth-provider-consistency-tasks.md`

## Purpose / Big Picture

Centralize SSO token validation and make email provider selection explicit rather
than tied to `DEBUG`.

## Progress

- [x] Create design doc, plan, and task checklist.
- [ ] Add failing tests for shared SSO nonce/timestamp validation.
- [ ] Extract shared validator used by both SSO paths.
- [ ] Add `EMAIL_PROVIDER` setting and validation.
- [ ] Refactor email sender selection.
- [ ] Run backend/docs gates and archive.

## Key Files

- `backend/services/auth.py`
- `backend/services/sso_oidc.py`
- `backend/services/email_sender.py`
- `backend/config/settings.py`
- `tests/test_auth_service_sso_ldap.py`
- `tests/test_email_sender.py`

## Validation

```bash
uv run pytest tests/test_auth_service_sso_ldap.py tests/test_sso_oidc_flow.py tests/test_email_sender.py -v
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```
