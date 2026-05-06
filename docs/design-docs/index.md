# Design Docs Index

## Purpose

This directory stores durable design decisions, architecture notes, and review findings that are useful beyond a single task run.

## Current Documents

| File | Purpose |
|------|---------|
| `core-beliefs.md` | Stable engineering principles for the repository |
| `2026-04-12-code-review-findings.md` | Consolidated list of still-valid code review issues |
| `execution-gates-adoption.md` | Rationale and rollout notes for the repository execution gates |
| `client-skills-upload-api.md` | Stable Client API upload boundary for ZIP skill creation and version append via API Token |
| `public-skill-auto-version-upgrade.md` | Public skill root snapshot change detection and automatic patch version creation |
| `public-skill-sync-cli.md` | Stable contract for the host-side public skill sync command |
| `landing-page-light-mode.md` | Light-mode landing page visual design decisions and color mapping |
| `content-hash-dedup.md` | Content hash computation, storage, and three-state sync model for skill distribution dedup |
| `capability-contract.md` | Stable runtime capability contract rules and capability/permission boundary |
| `browser-session-token-storage.md` | Browser session token storage and cookie refresh boundary design |
| `refresh-token-hardening.md` | Stateful refresh-token rotation, token-family reuse detection, and revocation design |
| `distributed-rate-limit-stores.md` | Shared rate-limit store boundary for global and download limits |
| `backend-service-boundaries.md` | Repository transaction and SkillService boundary refactor design |
| `audit-permission-consistency.md` | Audit recorder and permission constant consistency design |
| `skill-data-contract-cleanup.md` | Skill upload, visibility, kind, and serializer cleanup design |
| `legacy-compatibility-retirement.md` | Exit strategy for legacy shims and compatibility fallbacks |
| `auth-provider-consistency.md` | Shared SSO validation and explicit email provider selection design |
| `list-count-consistency.md` | Paginated list/count consistency decision framework |
| `documentation-freshness-automation.md` | Validator checks for stale docs, plan indexes, and tech-debt links |

## How To Use This Directory

- Put cross-cutting design decisions here.
- Do not store step-by-step implementation logs here; those belong in `docs/exec-plans/`.
- Keep filenames descriptive and stable so other docs can reference them.
