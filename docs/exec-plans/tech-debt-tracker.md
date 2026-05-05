# Tech Debt Tracker

Last updated: 2026-05-06

## Review Notes

- Removed the `users.delete_me()` error-shape debt. `backend/api/v1/users.py`
  now converts `VerificationError` through `build_http_error_detail()`, and
  `tests/test_users_api.py` covers structured delete-account verification errors.
- Refined enum debt after `enum-catalog-consolidation-plan.md`: skill visibility
  now has a shared catalog, but some backend literals and the separate `role` /
  `skill_kind` ownership decisions still need follow-up work.
- Expanded rate-limit debt to cover both global request limiting and download
  limiting, because both currently rely on process-local state.
- Opened `refresh-token-hardening` spec/design/plan/tasks as the first
  executable package for high-priority security debt.
- Added executable documentation packages for every remaining tracker item,
  grouped by implementation boundary.

## High Priority

| Topic | Current status | Why it matters | Source | Removal condition |
|------|----------------|----------------|--------|-------------------|
| Refresh token hardening | Planned | Current rotation behavior is weaker than strict single-use invalidation, token-family tracking, and reuse detection | `docs/product-specs/2026-05-06-refresh-token-hardening.md`, `docs/design-docs/refresh-token-hardening.md`, `docs/exec-plans/active/refresh-token-hardening-plan.md`, `docs/SECURITY.md` | Refresh tokens are statefully rotated, old tokens are invalidated after use, reuse is detected, and regression tests cover replay attempts |
| Distributed rate-limit stores | Planned | `RateLimitMiddleware` and download rate limiting both use process-local memory, so multi-worker or multi-instance deployments can bypass limits | `docs/product-specs/2026-05-06-distributed-rate-limits.md`, `docs/design-docs/distributed-rate-limit-stores.md`, `docs/exec-plans/active/distributed-rate-limit-stores-plan.md` | Rate-limit state is behind a store abstraction with a production shared backend setting and tests for global and download limit behavior |
| Repository transaction boundaries | Planned | Repository commit behavior is inconsistent across models, making multi-step service operations harder to reason about safely | `docs/design-docs/backend-service-boundaries.md`, `docs/exec-plans/active/backend-service-boundaries-plan.md` | Repository writes use a consistent Unit of Work or equivalent transaction boundary, and service tests cover multi-step rollback behavior |
| `SkillService` facade decomposition | Planned | `SkillService` remains a broad facade over lifecycle, versioning, storage, upload, clone, download, and crypto helpers, keeping workflow boundaries oversized | `docs/design-docs/backend-service-boundaries.md`, `docs/exec-plans/active/backend-service-boundaries-plan.md` | Route/service consumers depend on narrower coordinators or provider interfaces, and crypto helpers no longer live on the facade |

## Medium Priority

| Topic | Current status | Why it matters | Source | Removal condition |
|------|----------------|----------------|--------|-------------------|
| Router-level audit coupling | Planned | Audit event creation is still scattered across route handlers, which makes metadata shape and coverage easy to drift | `docs/design-docs/audit-permission-consistency.md`, `docs/exec-plans/active/audit-permission-consistency-plan.md` | Audit recording is centralized behind a dependency/helper that owns the feature flag guard and metadata defaults |
| Skill upload archive pipeline duplication | Planned | Create-skill and append-version ZIP upload paths share substantial archive processing logic, increasing bug-fix drift risk | `docs/design-docs/skill-data-contract-cleanup.md`, `docs/exec-plans/active/skill-data-contract-cleanup-plan.md` | Shared archive processing is extracted and both create/update paths use it with focused tests |
| Remaining enum/catalog cleanup | Planned | Skill visibility has a shared catalog, but `role` remains settings/RBAC-backed, `skill_kind` remains backend-derived, and a few backend visibility literals remain in upload/query paths | `docs/design-docs/skill-data-contract-cleanup.md`, `docs/exec-plans/active/skill-data-contract-cleanup-plan.md` | Role and skill-kind ownership decisions are either implemented or documented as final, and writable visibility validation uses shared helpers everywhere |
| `user_state.py` compatibility shim | Planned | Legacy imports keep the old security-module path alive and obscure that user status now belongs to `backend.domain.user_status` | `docs/design-docs/legacy-compatibility-retirement.md`, `docs/exec-plans/active/legacy-compatibility-retirement-plan.md` | All tests/helpers import from `backend.domain.user_status`, then the shim is removed |
| `_list_cloned_source_ids_legacy_fallback()` | Planned | Legacy clone metadata fallback is still needed for old records missing `cloned_from_skill_id` | `docs/design-docs/legacy-compatibility-retirement.md`, `docs/exec-plans/active/legacy-compatibility-retirement-plan.md` | Data migration/backfill proves all clone records have `cloned_from_skill_id`, and fallback tests are removed or updated |
| `_handle_legacy_skill_value_error()` | Planned | Raw `ValueError` compatibility remains as a safety net for old service paths and lacks usage monitoring | `docs/design-docs/legacy-compatibility-retirement.md`, `docs/exec-plans/active/legacy-compatibility-retirement-plan.md` | Service layer consistently raises `SkillError`, fallback hit count is zero or monitored, and the legacy mapper is removed |
| SSO nonce/timestamp validation duplication | Planned | `AuthService.login_sso()` and `SSOOIDCService.validate_nonce_and_timestamps()` can drift in security-sensitive validation behavior | `docs/design-docs/auth-provider-consistency.md`, `docs/exec-plans/active/auth-provider-consistency-plan.md` | One shared nonce/timestamp validator is used by both SSO paths, with tests for nonce, `iat`, and `exp` failures |
| List/count snapshot consistency | Planned | List endpoints fetch page items and totals in separate queries, so concurrent writes can produce brief pagination inconsistencies | `docs/product-specs/2026-05-06-list-count-consistency.md`, `docs/design-docs/list-count-consistency.md`, `docs/exec-plans/active/list-count-consistency-plan.md` | List APIs use a consistent snapshot strategy or explicitly document and test accepted eventual consistency |

## Low Priority

| Topic | Current status | Why it matters | Source | Removal condition |
|------|----------------|----------------|--------|-------------------|
| Email sender provider selection | Planned | `get_email_sender()` still ties provider choice to `DEBUG`, which conflates deployment mode with infrastructure selection | `docs/design-docs/auth-provider-consistency.md`, `docs/exec-plans/active/auth-provider-consistency-plan.md` | A dedicated `EMAIL_PROVIDER` setting selects SMTP/Aliyun/dev sender behavior and tests cover provider selection |
| Raw permission strings in routes | Planned | Route handlers still use raw strings such as `require_permission("skill.list")` despite central `Permission` constants | `docs/design-docs/audit-permission-consistency.md`, `docs/exec-plans/active/audit-permission-consistency-plan.md` | Route dependencies use `Permission.*` constants, and a focused test or lint check prevents new raw permission literals |
| `serialize_skill` response assembly | Planned | Skill response serialization still combines model validation, dict mutation, and revalidation, which is harder to evolve safely | `docs/design-docs/skill-data-contract-cleanup.md`, `docs/exec-plans/active/skill-data-contract-cleanup-plan.md` | Serialization has a single clear builder/schema path with tests for aliases and derived fields |
| Documentation freshness automation | Planned | Docs structure and indexes are validated, but freshness still relies on manual gardening | `docs/design-docs/documentation-freshness-automation.md`, `docs/exec-plans/active/documentation-freshness-automation-plan.md` | A script or CI check reports stale plan/index/doc references beyond basic path validation |

## Debt Handling Rules

- Add debt here when it spans more than one file or more than one task.
- Remove or downgrade debt when a merged change clearly addresses it.
- Keep each debt item tied to a concrete source and an observable removal
  condition.
- Link back to the plan or design doc that best explains the issue.
