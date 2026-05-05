# Legacy Compatibility Retirement Design

## Status

Proposed for implementation.

## Problem

Some compatibility paths remain after earlier migrations:

- `backend/core/security/user_state.py` re-exports user-status domain symbols
- `_list_cloned_source_ids_legacy_fallback()` supports old clone metadata
- `_handle_legacy_skill_value_error()` maps raw `ValueError` strings

These are useful migration safety nets, but each should have an exit path.

## Decision

Retire compatibility code only after proving no supported path still needs it.
Use tests and data backfill checks instead of removing shims by assumption.

## Retirement Rules

- Replace imports before deleting shims.
- Add migration/backfill or diagnostics before deleting data fallbacks.
- Add monitoring or focused tests before deleting error compatibility mappers.
- Keep public API behavior stable while removing internal compatibility paths.

## Validation

- Search-based checks for legacy imports.
- Migration tests for clone source fields.
- Skill error mapping tests.
- Backend hard gates.
