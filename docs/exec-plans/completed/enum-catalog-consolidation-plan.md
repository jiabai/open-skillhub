# Enum Catalog Consolidation Follow-up

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

User status now has a clean build-time sync workflow, but other enum-like concepts
 still drift across backend logic, frontend display code, tests, and
settings-driven defaults. This follow-up determines which of the remaining concepts
should become shared authored catalogs and which should stay derived or
configuration-backed.

The current focus is:

- `role`
- `visibility`
- `skill_kind`

The goal is not to force all three into the same implementation. The goal is to
end with explicit per-concept decisions about authoring source, runtime ownership,
sync targets if any, and the narrowest safe validation strategy.

## Progress

- [x] (2026-05-05) Inventory all backend, frontend, settings, and test touchpoints
  for `role`, `visibility`, and `skill_kind`
- [x] (2026-05-05) Decide which concepts should become shared authored catalogs and
  which should remain derived or settings-driven
- [x] (2026-05-05) Define build-time sync targets only for concepts that benefit from
  committed runtime-local copies
- [x] (2026-05-05) Implement the first approved consolidation batch:
  `visibility` shared authored catalog plus backend/frontend runtime-local copies
- [x] (2026-05-05) Add focused validation and update docs or deployment guidance if
  the chosen design affects build or runtime behavior

## Surprises & Discoveries

- Observation: `role` is more than a simple label set.
  Evidence: backend defaults and permission maps live in
  `backend/config/settings.py` and `backend/core/security/rbac.py`, while the
  frontend separately defines role options and labels in
  `frontend/src/app/admin/users/page.tsx` and `frontend/src/lib/user-identity-display.ts`.

- Observation: `visibility` already has multiple semantics depending on the
  surface.
  Evidence: backend skill mutation paths in `backend/services/skill.py` accept
  editable values such as `private`, `team`, and `enterprise`, while frontend
  types in `frontend/src/types/index.ts` also model `public` for public-skill
  responses and read-only surfaces.

- Observation: `skill_kind` behaves as a backend-derived view value, not a
  user-authored field.
  Evidence: `backend/services/skill.py` derives `regular`, `public`, `reference`,
  and `clone`, and `backend/api/v1/skills_support.py` serializes that derived
  value to the frontend.

- Observation: `visibility` is the narrowest first implementation batch because
  it has a stable authored value set but two distinct scopes.
  Evidence: `backend/schemas/skill.py` and `backend/services/skill_lifecycle.py`
  accept writable values `private`, `team`, and `enterprise`; read models and
  public-skill queries also use `public`; frontend type and UI files repeat the
  same split.

- Observation: frontend build was blocked by an unrelated App Router page prop
  mismatch in `frontend/src/app/page.tsx`.
  Evidence: `npm run build` failed because `HomePage` accepted a custom
  `currentUser` prop even though `AppShell` already provides current user via
  `CurrentUserProvider`.

## Decision Log

- Decision: do not assume `role`, `visibility`, and `skill_kind` should all use
  the same `shared JSON + synced local copies` pattern.
  Rationale: each concept has different ownership and semantics, and reusing the
  user-status pattern blindly would risk flattening important domain distinctions.
  Date/Author: 2026-04-20 / Codex

- Decision: treat `skill_kind` as a derived contract candidate first, not an
  authored enum candidate.
  Rationale: it originates from backend classification logic, so any consolidation
  must preserve backend derivation as the source of truth.
  Date/Author: 2026-04-20 / Codex

- Decision: implement `visibility` as the first batch using a shared authored
  catalog synced into committed backend and frontend generated copies.
  Rationale: visibility values are not environment-specific, both runtimes need
  the same editable/read-only distinction, and the user-status sync pattern
  already proves this repository can safely consume committed runtime-local JSON.
  Date/Author: 2026-05-05 / Codex

- Decision: keep `role` settings/RBAC-backed in this batch.
  Rationale: the role names are coupled to permission maps and deployment
  overrides (`RBAC_ROLE_PERMISSIONS`), so a role catalog needs a separate design
  that does not weaken config ownership of permissions.
  Date/Author: 2026-05-05 / Codex

- Decision: keep `skill_kind` backend-derived in this batch.
  Rationale: the frontend should consume serialized `skill_kind` as an API
  contract, while backend classification remains the source of truth.
  Date/Author: 2026-05-05 / Codex

## Outcomes & Retrospective

Completed. The first enum consolidation batch moved `visibility` to a shared
authored catalog with committed backend/frontend runtime-local copies, while
leaving `role` and `skill_kind` as explicitly documented follow-ups/non-goals for
this batch.

## Context and Orientation

### Core backend anchors

| Path | Why it matters |
|------|----------------|
| `backend/config/settings.py` | Owns default role and default visibility settings |
| `backend/core/security/rbac.py` | Owns RBAC role names and permission mapping behavior |
| `backend/services/skill.py` | Validates editable visibility values and derives `skill_kind` |
| `backend/api/v1/skills_support.py` | Serializes derived `skill_kind` into API responses |

### Core frontend anchors

| Path | Why it matters |
|------|----------------|
| `frontend/src/types/index.ts` | Defines `SkillVisible`, `SkillKind`, and user role-bearing types |
| `frontend/src/lib/user-identity-display.ts` | Encodes role display and badge behavior |
| `frontend/src/app/admin/users/page.tsx` | Hardcodes role options and status/role form behavior |
| `frontend/src/app/skills/new/page.tsx` | Uses editable visibility options for skill creation |

### Concept-by-concept framing

- `role`
  Should be evaluated across backend defaults, RBAC behavior, API payloads, and
  frontend admin/display options. Permission membership is likely configuration-
  driven even if role names become catalog-backed.

- `visibility`
  Should be split between editable mutation values and read-model values. The plan
  must preserve the distinction between private/team/enterprise edit paths and the
  public-skill surfaces that expose `public`.

- `skill_kind`
  Should be treated as an API contract emitted from backend classification logic.
  Any shared typing should consume backend-owned truth rather than invent new
  authored values in the frontend.

## Plan of Work

1. Inventory each concept separately instead of bundling them into one abstract
   “shared enum” task.
2. For each concept, decide whether the source of truth is:
   - authored catalog
   - backend-derived contract
   - settings/config-backed behavior
3. Only after those decisions, choose whether any concept needs:
   - a shared source file
   - build-time synced local copies
   - generated frontend/backend assets
4. Implement the smallest first batch that delivers one fully-consistent concept
   end to end, then validate before expanding scope.

## First Implementation Batch

The approved first batch is `visibility` only.

Files to add or update:

- `shared/skill-visibilities.json` as the authored source.
- `backend/domain/skill-visibilities.json` as the backend runtime-local copy.
- `frontend/src/generated/skill-visibilities.json` as the frontend runtime-local
  copy.
- `scripts/sync_shared_catalogs.py` so `--write` and `--check` cover both
  user-status and visibility catalogs.
- `backend/domain/skill_visibility.py` for backend constants, type aliases, and
  normalization/validation helpers.
- `backend/schemas/skill.py`, `backend/services/skill_lifecycle.py`, and
  `backend/core/security/rbac.py` to consume the backend domain helpers.
- `frontend/src/lib/skill-visibility.ts`, `frontend/src/types/index.ts`,
  `frontend/src/lib/api.ts`, and the skill creation/detail pages to consume the
  generated frontend catalog instead of repeating raw option arrays.

Out of scope for this batch:

- Changing database values or adding migrations.
- Moving RBAC permissions into a shared role catalog.
- Moving `skill_kind` derivation out of backend services.

## Concrete Steps

### Inventory phase

```bash
cd D:\Github\skilldrive
Get-Content backend\core\security\rbac.py
Get-Content backend\services\skill.py
Get-Content frontend\src\types\index.ts
Get-Content frontend\src\lib\user-identity-display.ts
Get-Content frontend\src\app\admin\users\page.tsx
Get-Content frontend\src\app\skills\new\page.tsx
```

Expected result: a per-concept map of where names, validation, defaults, and UI
options are duplicated.

### Design checkpoint

For each concept, record:

- authoring source
- runtime owner
- whether the values are editable, derived, or settings-driven
- whether build-time sync is appropriate
- which narrow tests will prove success

Expected result: no implementation step depends on an unstated design decision.

## Validation and Acceptance

Validation flow for this follow-up:

1. Add failing backend/frontend tests for the visibility catalog sync and runtime
   helpers before implementation.
2. Run focused backend tests for shared catalog sync and visibility validation.
3. Run focused frontend tests for generated visibility catalog consumption.
4. Run backend hard gates when backend code changes:
   `uv run pytest`, `uv run ruff check .`, and `uv run mypy backend`.
5. Run frontend hard gates when frontend code changes:
   `cd frontend && npm run lint`, `cd frontend && npm test`, and
   `cd frontend && npm run build`.
6. Run `python scripts/validate_agents_docs.py --level ERROR` after plan updates
   and after archiving.
7. Keep the active/completed indexes aligned with the final plan locations.

Acceptance criteria:

- `user-status-followup-plan.md` is archived and no longer carries unrelated
  pending work.
- this active plan explicitly owns `role`, `visibility`, and `skill_kind`
  follow-up work.
- the plan leaves no ambiguity about the need for per-concept design decisions
  before implementation.
- `visibility` has a single authored source and committed backend/frontend
  generated copies.
- backend create/update/clone visibility validation consumes shared visibility
  helpers.
- frontend skill visibility types and editable options consume generated catalog
  helpers rather than local value arrays.

## Validation Log

- 2026-05-05: Red tests confirmed missing target interfaces before
  implementation:
  `uv run pytest tests/test_sync_shared_catalogs.py` failed on missing
  `backend.domain.skill_visibility`, and
  `npm.cmd test -- --run src/__tests__/skill-visibility.test.ts` failed on
  missing `@/generated/skill-visibilities.json`.
- 2026-05-05: Focused tests passed after implementation:
  `uv run pytest tests/test_sync_shared_catalogs.py` passed with 4 tests, and
  `npm.cmd test -- --run src/__tests__/skill-visibility.test.ts` passed with
  2 tests.
- 2026-05-05: Related focused checks passed:
  `python scripts/sync_shared_catalogs.py --check`,
  `uv run pytest tests/test_sync_shared_catalogs.py tests/test_visibility_rbac.py tests/test_api_skills.py::test_create_skill_invalid_visible_returns_422 tests/test_api_skills.py::test_update_skill_invalid_visible_returns_422 tests/test_api_skills.py::test_clone_skill_invalid_visible_returns_422 tests/test_api_skills.py::test_skill_visible_field_alias`,
  and
  `npm.cmd test -- --run src/__tests__/skill-visibility.test.ts src/__tests__/api-public-skills.test.ts`.
- 2026-05-05: Backend gates passed:
  `uv run pytest` passed with 640 tests, `uv run ruff check .` passed, and
  `uv run mypy backend` passed.
- 2026-05-05: Frontend gates passed:
  `npm.cmd run lint`, `npm.cmd test` passed with 64 tests, and
  `npm.cmd run build` passed after removing the invalid `currentUser` page prop
  from `frontend/src/app/page.tsx`.
- 2026-05-05: Documentation gate passed:
  `python scripts/validate_agents_docs.py --level ERROR` reported 0 errors and
  0 warnings.
