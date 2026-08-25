# Active Exec Plans

## Current Plans

| File | Focus |
|------|-------|
| `browser-session-token-storage-plan.md` | Remove durable browser token-pair storage and URL-fragment token exposure |
| `distributed-rate-limit-stores-plan.md` | Add shared store boundaries for global and download rate limits |
| `backend-service-boundaries-plan.md` | Standardize repository transaction boundaries and narrow SkillService facade usage |
| `audit-permission-consistency-plan.md` | Centralize audit recording defaults and replace raw permission route literals |
| `skill-data-contract-cleanup-plan.md` | Clean up skill upload, visibility, kind, and serialization contracts |
| `legacy-compatibility-retirement-plan.md` | Retire legacy shims and fallbacks after tests/backfills prove safety |
| `auth-provider-consistency-plan.md` | Share SSO validation and make email provider selection explicit |
| `list-count-consistency-plan.md` | Make paginated list/count consistency explicit and tested |

## Task Checklists

| File | Companion Plan |
|------|----------------|
| `audit-permission-consistency-tasks.md` | `audit-permission-consistency-plan.md` |
| `auth-provider-consistency-tasks.md` | `auth-provider-consistency-plan.md` |
| `backend-service-boundaries-tasks.md` | `backend-service-boundaries-plan.md` |
| `browser-session-token-storage-tasks.md` | `browser-session-token-storage-plan.md` |
| `distributed-rate-limit-stores-tasks.md` | `distributed-rate-limit-stores-plan.md` |
| `legacy-compatibility-retirement-tasks.md` | `legacy-compatibility-retirement-plan.md` |
| `list-count-consistency-tasks.md` | `list-count-consistency-plan.md` |
| `skill-data-contract-cleanup-tasks.md` | `skill-data-contract-cleanup-plan.md` |

## Working Agreement

- Update the plan itself when scope, progress, or discoveries change.
- Prefer moving a finished file to `../completed/` over leaving stale work here.
