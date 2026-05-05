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

## High Priority

| Topic | Current status | Why it matters | Source | Removal condition |
|------|----------------|----------------|--------|-------------------|
| Refresh token hardening | Open | Current rotation behavior is weaker than strict single-use invalidation, token-family tracking, and reuse detection | `docs/design-docs/2026-04-12-code-review-findings.md`, `docs/SECURITY.md` | Refresh tokens are statefully rotated, old tokens are invalidated after use, reuse is detected, and regression tests cover replay attempts |
| Distributed rate-limit stores | Open | `RateLimitMiddleware` and download rate limiting both use process-local memory, so multi-worker or multi-instance deployments can bypass limits | `backend/core/middleware/rate_limit.py`, `backend/api/v1/skills_support/download.py`, `docs/exec-plans/completed/backend-engineering-refactor-plan.md` | Rate-limit state is behind a store abstraction with a production shared backend setting and tests for global and download limit behavior |
| Repository transaction boundaries | Open | Repository commit behavior is inconsistent across models, making multi-step service operations harder to reason about safely | `docs/exec-plans/completed/backend-engineering-refactor-plan.md` Issue 5 | Repository writes use a consistent Unit of Work or equivalent transaction boundary, and service tests cover multi-step rollback behavior |
| `SkillService` facade decomposition | Open | `SkillService` remains a broad facade over lifecycle, versioning, storage, upload, clone, download, and crypto helpers, keeping workflow boundaries oversized | `backend/services/skill.py`, `docs/exec-plans/completed/backend-engineering-refactor-plan.md` Issue 1 | Route/service consumers depend on narrower coordinators or provider interfaces, and crypto helpers no longer live on the facade |

## Medium Priority

| Topic | Current status | Why it matters | Source | Removal condition |
|------|----------------|----------------|--------|-------------------|
| Router-level audit coupling | Open | Audit event creation is still scattered across route handlers, which makes metadata shape and coverage easy to drift | `docs/exec-plans/completed/backend-engineering-refactor-plan.md` Issue 2 | Audit recording is centralized behind a dependency/helper that owns the feature flag guard and metadata defaults |
| Skill upload archive pipeline duplication | Open | Create-skill and append-version ZIP upload paths share substantial archive processing logic, increasing bug-fix drift risk | `backend/services/skill_upload.py`, `docs/exec-plans/completed/backend-engineering-refactor-plan.md` Issue 10 | Shared archive processing is extracted and both create/update paths use it with focused tests |
| Remaining enum/catalog cleanup | Partially complete | Skill visibility has a shared catalog, but `role` remains settings/RBAC-backed, `skill_kind` remains backend-derived, and a few backend visibility literals remain in upload/query paths | `docs/exec-plans/completed/enum-catalog-consolidation-plan.md`, `backend/services/skill_upload.py`, `backend/repositories/skill.py` | Role and skill-kind ownership decisions are either implemented or documented as final, and writable visibility validation uses shared helpers everywhere |
| `user_state.py` compatibility shim | Open | Legacy imports keep the old security-module path alive and obscure that user status now belongs to `backend.domain.user_status` | `backend/core/security/user_state.py` | All tests/helpers import from `backend.domain.user_status`, then the shim is removed |
| `_list_cloned_source_ids_legacy_fallback()` | Open | Legacy clone metadata fallback is still needed for old records missing `cloned_from_skill_id` | `backend/repositories/skill.py` | Data migration/backfill proves all clone records have `cloned_from_skill_id`, and fallback tests are removed or updated |
| `_handle_legacy_skill_value_error()` | Open | Raw `ValueError` compatibility remains as a safety net for old service paths and lacks usage monitoring | `backend/api/v1/skills_support/error_mapper.py` | Service layer consistently raises `SkillError`, fallback hit count is zero or monitored, and the legacy mapper is removed |
| SSO nonce/timestamp validation duplication | Open | `AuthService.login_sso()` and `SSOOIDCService.validate_nonce_and_timestamps()` can drift in security-sensitive validation behavior | `backend/services/auth.py`, `backend/services/sso_oidc.py`, `docs/exec-plans/completed/backend-engineering-refactor-plan.md` Issue 8 | One shared nonce/timestamp validator is used by both SSO paths, with tests for nonce, `iat`, and `exp` failures |
| List/count snapshot consistency | Open | List endpoints fetch page items and totals in separate queries, so concurrent writes can produce brief pagination inconsistencies | `docs/design-docs/2026-04-12-code-review-findings.md` | List APIs use a consistent snapshot strategy or explicitly document and test accepted eventual consistency |

## Low Priority

| Topic | Current status | Why it matters | Source | Removal condition |
|------|----------------|----------------|--------|-------------------|
| Email sender provider selection | Open | `get_email_sender()` still ties provider choice to `DEBUG`, which conflates deployment mode with infrastructure selection | `backend/services/email_sender.py`, `docs/exec-plans/completed/backend-engineering-refactor-plan.md` Issue 9 | A dedicated `EMAIL_PROVIDER` setting selects SMTP/Aliyun/dev sender behavior and tests cover provider selection |
| Raw permission strings in routes | Open | Route handlers still use raw strings such as `require_permission("skill.list")` despite central `Permission` constants | `backend/api/v1/skills.py`, `backend/core/deps.py`, `backend/core/permissions.py` | Route dependencies use `Permission.*` constants, and a focused test or lint check prevents new raw permission literals |
| `serialize_skill` response assembly | Open | Skill response serialization still combines model validation, dict mutation, and revalidation, which is harder to evolve safely | `docs/design-docs/2026-04-12-code-review-findings.md` | Serialization has a single clear builder/schema path with tests for aliases and derived fields |
| Documentation freshness automation | Open | Docs structure and indexes are validated, but freshness still relies on manual gardening | `docs/EXECUTION_GATES.md`, repository process follow-up | A script or CI check reports stale plan/index/doc references beyond basic path validation |

## Debt Handling Rules

- Add debt here when it spans more than one file or more than one task.
- Remove or downgrade debt when a merged change clearly addresses it.
- Keep each debt item tied to a concrete source and an observable removal
  condition.
- Link back to the plan or design doc that best explains the issue.
