# Skill Data Contract Cleanup Design

## Status

Proposed for implementation.

## Problem

Skill data paths still have several medium/low-priority maintainability debts:

- ZIP upload create/update paths duplicate archive processing
- visibility has a shared catalog, but not every backend path consumes the helper
- `skill_kind` remains backend-derived and should stay documented as such
- skill response serialization is more complex than necessary

## Decision

Treat this as a skill data contract cleanup batch, not a product feature batch.
Keep behavior stable while centralizing shared data rules and serializers.

## Boundaries

- Upload archive parsing belongs in one private pipeline or helper.
- Writable visibility validation should use `backend.domain.skill_visibility`.
- Public/read-only visibility query literals may remain only if documented or
  replaced with named constants from the same domain module.
- `skill_kind` stays backend-derived.
- Skill serialization should have one clear builder path.

## Validation

- Existing skill API tests.
- Upload branch tests.
- Visibility catalog sync tests.
- Frontend tests only if TypeScript response types or frontend helpers change.
