# DESIGN

## Purpose

This document captures stable design conventions for the main Open SkillHub codebase. It is intentionally shorter than a full architecture guide and more durable than task plans.

## Documentation Design

- Keep `AGENTS.md` files short and map-like.
- Put detailed decisions in `docs/design-docs/`.
- Put feature intent in `docs/product-specs/`.
- Put active or historical execution work in `docs/exec-plans/`.
- Update README and index files when documents move.

## Backend Design Rules

- Preserve the layered flow `route -> service -> repository -> database/filesystem`.
- Keep transport formatting in routes or adapters, not inside core business logic.
- Prefer shared helpers over repeated error-shaping or serialization logic.
- Treat feature flags and runtime capabilities as backend-owned contracts.

## Frontend Design Rules

- Treat `frontend/src/lib/api.ts` as the backend access boundary.
- Treat `frontend/src/i18n/` as the localization boundary.
- Favor composition through `components/app/` instead of page-local duplication.
- Keep state and capability derivation close to providers and hooks.

## Operational Design Rules

- Prefer simple, explicit deployment topology over hidden automation.
- Keep build-time configuration and runtime configuration clearly separated.
- When a behavior matters in production, document it in `docs/` near related references or plans.

## Quality Targets

- Favor files that stay understandable without scrolling through several unrelated responsibilities.
- Prefer one clear source of truth for capability contracts, shared enums, and security-sensitive flows.
- When a module becomes a frequent source of follow-up plans, record the debt in `docs/exec-plans/tech-debt-tracker.md`.
