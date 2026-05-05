# Runtime Capabilities Enhancement Tasks

Status: Completed
Updated: 2026-05-05

## Checklist

- [x] Review and correct the active ExecPlan before coding.
- [x] Add backend capability derivation tests for public skill, audit export, direct flag, and no-RBAC default edge cases.
- [x] Add frontend permission helper tests before creating the helper implementation.
- [x] Implement `frontend/src/lib/user-permissions.ts`.
- [x] Wire app shell/dashboard navigation to the helper layer.
- [x] Create `docs/design-docs/capability-contract.md` and update the design-docs index.
- [x] Run focused backend and frontend tests.
- [x] Run full execution gates required by `docs/EXECUTION_GATES.md`.
- [x] Move completed plan and tasks into `docs/exec-plans/completed/`.
- [x] Update active/completed execution plan indexes.

## Notes

- Keep capability checks workspace-level and permission checks user-level.
- Do not treat `public_skills` as a create-public-skill permission; it is a public catalog capability.
- The no-RBAC default is `no_rbac_mode=true`, even when all optional feature flags are disabled.
