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

- [ ] (pending) Inventory all backend, frontend, settings, and test touchpoints
  for `role`, `visibility`, and `skill_kind`
- [ ] (pending) Decide which concepts should become shared authored catalogs and
  which should remain derived or settings-driven
- [ ] (pending) Define build-time sync targets only for concepts that benefit from
  committed runtime-local copies
- [ ] (pending) Implement the first approved consolidation batch
- [ ] (pending) Add focused validation and update docs or deployment guidance if
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

## Outcomes & Retrospective

Not yet started. This plan exists because the user-status build-time sync work is
finished and remaining enum-like duplication now needs its own dedicated
workstream.

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

## Concrete Steps

### Inventory phase

```bash
cd D:\Github\open-skillhub
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

1. Run `python scripts/validate_agents_docs.py --level ERROR` after plan updates.
2. Keep the active/completed indexes aligned with the final plan locations.
3. For any future implementation batch created from this plan, require narrow
   tests for the first concept migrated rather than a broad all-enum sweep.

Acceptance criteria:

- `user-status-followup-plan.md` is archived and no longer carries unrelated
  pending work.
- this active plan explicitly owns `role`, `visibility`, and `skill_kind`
  follow-up work.
- the plan leaves no ambiguity about the need for per-concept design decisions
  before implementation.
