# Auth Provider Consistency Tasks

Status: Draft for Review
Updated: 2026-05-06

- [x] Create executable documentation package.
- [ ] Write failing tests that show direct SSO and OIDC callback use the same nonce/timestamp validator.
- [ ] Extract shared nonce/timestamp validator.
- [ ] Refactor `AuthService.login_sso()` to use the shared validator.
- [ ] Add `EMAIL_PROVIDER` setting with accepted values.
- [ ] Refactor `get_email_sender()` to select by `EMAIL_PROVIDER`.
- [ ] Add settings/email sender tests.
- [ ] Run focused auth/email tests.
- [ ] Run full backend/docs gates.
- [ ] Update `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Archive plan and tasks.
