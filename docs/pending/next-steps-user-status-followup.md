# Next Steps

## Recommended First

1. Add a consistency test for shared user status definitions.
   - Verify `shared/user-statuses.json` matches backend `UserStatus`.
   - Verify frontend `USER_STATUS_VALUES` and `DEFAULT_USER_STATUS` stay aligned with the shared file.
   - Goal: prevent future drift between backend, frontend, and tests.

## Recommended After That

2. Extend the same shared-definition pattern to other enums/constants.
   - `role`
   - `visibility`
   - `skill_kind`
   - Goal: reduce logic bugs caused by duplicated raw strings across backend/frontend/tests.

## Optional Validation Pass

3. Run a broader governance/auth regression sweep after enum unification.
   - Auth
   - RBAC
   - SSO
   - Skills visibility/download
   - Goal: catch edge regressions after constant consolidation.

## Notes

- User status raw strings are already consolidated except for historical migration snapshots.
- Do not rewrite old migration snapshots unless there is a migration-specific reason.
