# Documentation Freshness Automation Design

## Status

Proposed for implementation.

## Problem

`scripts/validate_agents_docs.py` validates important paths and indexes, but it
does not detect stale plan state, unlinked active tasks, or tech-debt entries that
claim planned work without a matching plan.

## Decision

Extend documentation validation in small, opt-in checks before making anything
too strict:

- active plan/task pairing checks
- tech-debt source link existence checks
- active/completed index consistency checks
- stale `Status: In Progress` checks for completed plans

## Validation

- Unit tests for validator helpers.
- `python scripts/validate_agents_docs.py --level ERROR`.
- A warning-first rollout before new checks become hard errors.
