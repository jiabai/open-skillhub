# Runtime Capabilities Enhancement Follow-up

Status: Completed
Updated: 2026-05-05

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

The runtime-config / capabilities migration is complete. The backend is the single
source of truth for business capabilities, and the frontend consumes them through
`useRuntimeConfig()`. This follow-up addresses three optional enhancements that
were explicitly deferred during the main migration:

1. **Expand capability contract test coverage** — ensure the backend capability
   derivation logic is robust against configuration edge cases.
2. **Introduce a frontend permission helper layer** — separate system capability
   (what the workspace supports) from user permission (what this user can do).
3. **Document capability contract constraints** — create durable guidance so future
   capability additions follow consistent rules.

The visible result: stronger test coverage around capability derivation, a clear
code boundary between "workspace can do X" and "this user may do X", and a
reference document that explains how to safely evolve the capability contract.

## Progress

- [x] (completed) Add backend integration tests for capability edge cases
- [x] (completed) Create frontend permission helper module and wire navigation consumers
- [x] (completed) Write capability contract constraint documentation
- [x] (completed) Run full validation suite
- [x] (completed) Archive the plan and task checklist after validation

## Surprises & Discoveries

- The frontend default runtime capabilities intentionally keep `no_rbac_mode=true`
  when RBAC is disabled; "all defaults false" would contradict the backend
  capability formula.
- The audit backend uses management access, so audit navigation must combine
  workspace capability with admin/superuser user permission.
- `public_skills` describes public catalog availability, not a writable "create
  public skill" permission.

## Decision Log

- Decision: Keep capability and permission as separate concepts.
  Rationale: Capability answers "does this workspace support this feature?" while
  permission answers "is this user allowed to perform this action?". Mixing them
  creates confusion when a feature exists but a user lacks access.
  Date/Author: 2026-05-05 / Codex

- Decision: Test coverage should focus on capability derivation, not individual
  settings parsing.
  Rationale: Settings parsing is already validated by pydantic; the interesting
  logic is how settings combine into derived capabilities like `public_skills`.
  Date/Author: 2026-05-05 / Codex

- Decision: Permission helper names should reflect runtime behavior rather than
  hypothetical write actions.
  Rationale: There is no frontend/backend contract for creating public skills as
  a user action. The helper layer should cover current user-facing decisions such
  as managing users, viewing audit logs, exporting audit logs, using public skill
  catalog features, and using skill visibility controls.
  Date/Author: 2026-05-05 / Codex

## Outcomes & Retrospective

Implemented so far:

- Expanded runtime-config API coverage from 4 tests to 15 collected cases.
- Added `frontend/src/lib/user-permissions.ts` and focused tests for user/capability
  permission composition.
- Wired AppShell and Dashboard navigation to the permission helper layer.
- Added `docs/design-docs/capability-contract.md`.
- Validation passed:
  - `uv run pytest`
  - `uv run ruff check .`
  - `uv run mypy backend`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `python scripts/validate_agents_docs.py --level ERROR`

## Context and Orientation

### Current State

The runtime-config / capabilities system consists of:

| Layer | File | Purpose |
|-------|------|---------|
| Backend schema | `backend/schemas/runtime_config.py` | Defines `RuntimeCapabilities` and `RuntimeConfigResponse` |
| Backend service | `backend/services/runtime_config.py` | Derives capabilities from `settings` |
| Backend API | `backend/api/v1/runtime_config.py` | Exposes `/api/v1/runtime-config` |
| Backend tests | `tests/test_runtime_config_api.py` | 4 tests covering basic API behavior |
| Frontend client | `frontend/src/lib/runtime-config.ts` | TypeScript types and API client |
| Frontend provider | `frontend/src/components/app/runtime-config-provider.tsx` | React context provider |
| Frontend hook | `frontend/src/hooks/use-runtime-config.ts` | `useRuntimeConfig()` hook |

### Existing Capabilities

The backend currently derives these capabilities from internal settings:

| Capability | Derived From |
|------------|--------------|
| `skill_visibility` | `ENABLE_SKILL_VISIBILITY` |
| `public_skills` | `skill_visibility AND NOT rbac` |
| `org_model` | `ENABLE_ORG_MODEL` |
| `public_signup` | `ENABLE_PUBLIC_SIGNUP` |
| `email_otp_login` | `ENABLE_EMAIL_OTP_LOGIN` |
| `sso` | `ENABLE_SSO` |
| `ldap` | `ENABLE_LDAP` |
| `audit_log` | `ENABLE_AUDIT_LOG` |
| `audit_export` | `audit_log AND ENABLE_AUDIT_EXPORT` |
| `rbac` | `ENABLE_RBAC` |
| `no_rbac_mode` | `NOT rbac` |

### Key Files for This Work

- `backend/services/runtime_config.py` — capability derivation logic to test more thoroughly
- `backend/config/settings.py` — settings that feed into capability derivation
- `frontend/src/lib/runtime-config.ts` — TypeScript contract that must stay in sync
- `frontend/src/lib/user-identity-display.ts` — existing identity display helpers (reference for permission layer design)
- `docs/design-docs/` — where the capability contract documentation should live

## Plan of Work

### Phase 1: Expand Backend Test Coverage

Add integration tests to `tests/test_runtime_config_api.py` that cover:

1. **Combination edge cases** — verify `public_skills` is `false` when `rbac` is
   `true` regardless of `skill_visibility`.
2. **Dependency chains** — verify `audit_export` requires both `ENABLE_AUDIT_LOG`
   and `ENABLE_AUDIT_EXPORT`.
3. **Default behavior** — verify feature capabilities default to `false` when no
   feature flags are enabled while `no_rbac_mode` remains `true` because it is
   derived from `NOT rbac`.
4. **Boolean derivation correctness** — test each capability's derivation formula
   independently.

### Phase 2: Create Frontend Permission Helper

Create `frontend/src/lib/user-permissions.ts` that:

1. Accepts a `User` object and a `RuntimeCapabilities` object.
2. Exposes helper functions such as `isPlatformAdmin(user)`,
   `canManageUsers(user, capabilities)`, `canViewAuditLogs(user, capabilities)`,
   `canExportAuditLogs(user, capabilities)`, `canUsePublicSkillCatalog(user,
   capabilities)`, and `canUseSkillVisibilityControls(user, capabilities)`.
3. Separates workspace capability checks from user role/permission checks.
4. Follows the same pattern as `frontend/src/lib/user-identity-display.ts` for
   consistency.
5. Replaces inline navigation permission checks in app shell/dashboard code.

### Phase 3: Document Capability Contract Constraints

Create `docs/design-docs/capability-contract.md` that explains:

1. What a capability is (workspace-level feature support, not user permission).
2. Rules for adding new capabilities (must be derived in backend service, must have
   TypeScript type sync, must have tests).
3. Rules for deprecating capabilities (backward compatibility, sunset timeline).
4. The relationship between capability, permission, and feature flag concepts.

## Concrete Steps

### Step 1: Backend Test Expansion

```bash
cd D:\Github\open-skillhub

# Read existing tests
type tests\test_runtime_config_api.py

# Add new test cases covering edge combinations
# (edit tests/test_runtime_config_api.py)

# Validate
uv run pytest tests/test_runtime_config_api.py -v
```

Expected output: all existing 4 tests pass, plus 6-8 new tests.

### Step 2: Frontend Permission Helper

```bash
cd D:\Github\open-skillhub\frontend

# Create the permission helper module
# (create frontend/src/lib/user-permissions.ts)

# Create tests
# (create frontend/src/__tests__/user-permissions.test.ts)

# Validate
npm test -- src/__tests__/user-permissions.test.ts
```

Expected output: new test file passes with coverage for all helper functions.

### Step 3: Capability Contract Documentation

```bash
cd D:\Github\open-skillhub

# Create the design doc
# (create docs/design-docs/capability-contract.md)

# Verify it follows project conventions
python scripts/validate_agents_docs.py --level ERROR
```

Expected output: validation passes with no errors.

## Validation and Acceptance

Validation and Acceptance:

Validation flow:
1. Run backend tests: `uv run pytest tests/test_runtime_config_api.py -v`
   - Expect 10+ tests passing (existing 4 + new edge case tests)
2. Run frontend tests: `npm test -- src/__tests__/user-permissions.test.ts`
   - Expect all permission helper tests passing
3. Run full backend gates: `uv run pytest`, `uv run ruff check .`, and
   `uv run mypy backend`
   - Expect no backend regressions
4. Run full frontend gates: `npm run lint`, `npm test`, and `npm run build`
   - Expect no regressions in existing runtime-config tests
5. Verify documentation: `python scripts/validate_agents_docs.py --level ERROR`
   - Expect no errors
6. Verify patch hygiene: `git diff --check`
   - Expect no whitespace errors

Test verification:
- New backend tests should cover capability derivation edge cases that the existing
  4 tests do not address.
- New frontend permission tests should verify that capability checks and user role
  checks are properly separated.
- The capability contract document should be readable by someone unfamiliar with
  the system and explain how to safely add/remove capabilities.
