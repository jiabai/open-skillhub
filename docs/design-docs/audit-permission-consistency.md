# Audit And Permission Consistency Design

## Status

Proposed for implementation.

## Problem

Audit calls and permission literals are repeated in route modules. This creates
two drift risks:

- new mutating routes can forget audit logging or use inconsistent metadata
- raw permission strings can diverge from `backend/core/permissions.py`

## Decision

Create shared boundaries:

- an audit recorder/dependency that owns the `ENABLE_AUDIT_LOG` guard and default
  request metadata
- route dependencies that use `Permission.*` constants instead of raw strings
- tests or lint-style checks that reject new raw permission literals in route
  files

## Validation

- Existing audit API/service tests.
- Focused tests for audit metadata defaults.
- Focused test or script for raw permission string detection.
- Backend hard gates.
