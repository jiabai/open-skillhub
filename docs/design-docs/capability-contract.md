# Runtime Capability Contract

## Purpose

Runtime capabilities describe what this Open SkillHub deployment supports at the
workspace/system level. They are exposed by the backend through
`GET /api/v1/runtime-config` and consumed by the frontend through
`useRuntimeConfig()`.

Capabilities are not user permissions. A deployment can support audit logs while
the current user still lacks permission to view them. Frontend code should combine
runtime capabilities with user permission helpers instead of treating either side
as sufficient by itself.

## Contract Layers

| Concept | Owner | Answers |
|---------|-------|---------|
| Feature flag | Backend settings | Is this feature switched on for the deployment? |
| Capability | Backend runtime config service | Does this workspace/system support this behavior after derived rules are applied? |
| Permission | Backend auth/RBAC plus frontend helper mirrors | May this current user perform this action? |

The backend remains the source of truth for capability derivation. Frontend types
mirror the response shape so the console can render stable navigation and feature
surfaces, but frontend code must not invent deployment capabilities locally.

## Current Derivation Rules

The current runtime capability schema lives in
`backend/schemas/runtime_config.py`. Derivation lives in
`backend/services/runtime_config.py`.

Important derived capabilities:

- `public_skills` is true only when skill visibility is enabled and RBAC is off.
- `audit_export` is true only when audit logging and audit export are both enabled.
- `no_rbac_mode` is the inverse of `rbac`, so it is true when all optional feature
  flags are disabled.

`public_skills` describes public catalog availability. It is not a writable
"create public skill" permission.

## Frontend Permission Boundary

Frontend permission checks belong in `frontend/src/lib/user-permissions.ts`.
Callers should pass both `User` and `RuntimeCapabilities` into helper functions
such as `canManageUsers()`, `canViewAuditLogs()`, and `canExportAuditLogs()`.

Navigation and page entry points should consume those helpers rather than inline
role checks like `user.role === "admin"` next to raw capability booleans. This
keeps the UI aligned with backend access boundaries such as audit management
requiring both RBAC and admin/superuser identity.

## Adding Capabilities

When adding a runtime capability:

1. Add the backend schema field in `backend/schemas/runtime_config.py`.
2. Derive the value in `backend/services/runtime_config.py`; do not expose raw
   settings when the user-facing behavior depends on multiple settings.
3. Add or update backend tests in `tests/test_runtime_config_api.py`.
4. Update the TypeScript type and defaults in `frontend/src/lib/runtime-config.ts`.
5. If the capability affects user actions, update
   `frontend/src/lib/user-permissions.ts` and its tests.
6. Update product/design documentation when the new capability changes a public
   contract or operator-facing behavior.

Default values must be conservative. Optional feature capabilities should usually
default to `false`, while derived inverse flags like `no_rbac_mode` must preserve
their formula.

## Deprecating Capabilities

Capabilities are frontend/backend contracts. Removing or renaming one requires a
compatibility window:

1. Keep the old field until all known clients stop depending on it.
2. Add the replacement field alongside the old field when needed.
3. Document the deprecation in the relevant ExecPlan or design doc.
4. Remove frontend consumers before removing the backend field.
5. Keep tests covering both the compatibility period and final removal.

## Validation

Capability contract changes should run:

```bash
uv run pytest tests/test_runtime_config_api.py -v
cd frontend && npm test -- src/__tests__/runtime-config.test.tsx
cd frontend && npm test -- src/__tests__/user-permissions.test.ts
python scripts/validate_agents_docs.py --level ERROR
```

Broaden to full backend/frontend gates when a capability change affects routing,
navigation, auth, or shared frontend build behavior.
