# Distributed Rate-Limit Store Design

## Status

Proposed for implementation.

## Problem

The backend has two rate-limit implementations with process-local state. This
does not protect production deployments that use multiple workers or backend
instances.

## Decision

Introduce a store boundary for rate-limit counters. The middleware and download
guard should depend on store operations rather than owning counter dictionaries.

Recommended store contract:

- `hit(key: str, *, limit: int, window_seconds: int, now: float) -> bool`
- return `True` when the caller is over limit
- handle cleanup/expiry inside the store

## Store Options

| Store | Use case | Notes |
|-------|----------|-------|
| In-memory | local development and tests | preserves current zero-dependency startup |
| Redis or compatible shared cache | production multi-worker deployments | must be explicitly configured |

## Settings

Add explicit settings rather than inferring from environment:

- `RATE_LIMIT_STORE=memory|redis`
- `RATE_LIMIT_REDIS_URL`
- optionally separate download limits if the current settings are too broad

## Failure Behavior

If a configured shared store is unavailable, production should fail closed or fail
startup depending on the selected mode. Local `memory` mode should not require any
external service.

## Validation

- Unit tests for the in-memory store.
- Integration tests for middleware `429` response shape.
- Download-limit tests that use the same store abstraction.
- Configuration tests for unsupported store values.
