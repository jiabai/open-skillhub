# Backend Software Engineering Refactor Plan

Updated: 2026-05-04
Status: Draft
Purpose: Identify and prioritize software engineering design issues in the backend that are NOT covered by existing active execution plans, and propose a structured refactoring roadmap.

## Excluded Scope

The following issues are already tracked in active execution plans and are NOT repeated here:

- Error architecture unification → `error-architecture-refactor-plan.md`
- Enum catalog consolidation (role, visibility, skill_kind) → `enum-catalog-consolidation-plan.md`
- Runtime capabilities enhancement → `runtime-capabilities-enhancement-plan.md`
- Skills API boundary (JWT vs API-token) → `skills-api-boundary-plan.md`
- Legacy `ValueError` shim in error mapper → already in tech-debt-tracker
- `user_state.py` backward-compatible shim → already in tech-debt-tracker
- `_list_cloned_source_ids_legacy_fallback()` → already in tech-debt-tracker

## Issue 1: SkillService Is a God-Class Facade

### Problem

`backend/services/skill.py` defines `SkillService` as a single entry point that wraps five internal coordinators (`SkillLifecycleCoordinator`, `SkillVersionCoordinator`, `SkillStorageCoordinator`, `SkillUploadCoordinator`, `SkillDownloadService`) and exposes ~35 public methods that are almost entirely one-line delegations.

Evidence:

- The class constructor creates all five sub-services and stores them as instance attributes.
- Every public method body is a single `return await self.lifecycle.xxx(...)` or `return await self.versioning.xxx(...)` call.
- The class also carries static methods for encryption and checksum that belong to the download service or a dedicated crypto module.
- Router modules import `SkillService` directly and construct it via `build_skill_service()`, but then only use a subset of its methods.

### Impact

- Any change to any coordinator requires touching `SkillService` even if the change is internal.
- The class obscures which subset of operations a given consumer actually needs.
- Testing requires instantiating the full object graph even when only one coordinator is relevant.
- The encryption key derivation and AES-GCM encryption logic lives on `SkillService` as static methods, mixing cryptographic infrastructure with orchestration.

### Proposed Direction

- Replace `SkillService` with direct coordinator injection. Route handlers should receive the specific coordinator they need via dependency injection.
- Move `_build_encryption_key`, `_encrypt_payload`, and `_checksum_payload` to a dedicated `backend/core/utils/crypto.py` or into `SkillDownloadService` itself.
- Keep `build_skill_service()` as a factory that returns a typed structure (dataclass or named tuple) of coordinators, not a single god-class.

### Affected Files

- `backend/services/skill.py`
- `backend/api/v1/skills_support/service_factory.py`
- `backend/api/v1/skills.py`
- `backend/api/v1/client_skills.py`
- `backend/services/client_skill_catalog.py`

---

## Issue 2: Service-Router Audit Coupling Is Ad-Hoc

### Problem

Audit event creation is scattered across router handlers as inline imperative calls. Nearly every route handler that mutates state contains a `create_audit_event()` call with manually assembled parameters. This pattern has several problems:

Evidence:

- `backend/api/v1/skills.py` contains 10+ calls to `create_audit_event()`.
- `backend/api/v1/auth.py` contains 7+ inline `AuditService(AuditLogRepository(session)).create_event(...)` calls.
- `backend/api/v1/tokens.py` contains 3 inline audit calls.
- `backend/api/v1/audit.py` contains 1 inline audit call (for export).
- The audit call in `auth.py` uses a different pattern (`AuditService(AuditLogRepository(session)).create_event(...)`) than `skills.py` which uses the shared `create_audit_event()` helper.
- Some audit calls include `ip` and `user_agent`, others omit them.
- The `if settings.ENABLE_AUDIT_LOG:` guard is repeated at every call site.

### Impact

- Easy to forget audit logging on new endpoints.
- Inconsistent audit metadata shape across endpoints.
- The `ENABLE_AUDIT_LOG` guard is a runtime check that should be centralized.
- Router code is cluttered with cross-cutting concerns.

### Proposed Direction

- Introduce an `AuditContext` or `AuditRecorder` that is injected as a dependency and internally handles the `ENABLE_AUDIT_LOG` guard.
- Consider a decorator or middleware-based approach for common audit patterns (e.g., `@audit_action("skill.create")`).
- Standardize the audit metadata contract: every audit event should consistently include `ip`, `user_agent`, and relevant `metadata`.

### Affected Files

- `backend/api/v1/skills.py`
- `backend/api/v1/auth.py`
- `backend/api/v1/users.py`
- `backend/api/v1/tokens.py`
- `backend/api/v1/audit.py`
- `backend/api/v1/skills_support/audit.py`
- `backend/services/audit.py`

---

## Issue 3: In-Memory Rate Limiter Is Not Production-Suitable

### Problem

`RateLimitMiddleware` in `backend/core/middleware/rate_limit.py` uses an in-process `dict[str, list[float]]` with an `asyncio.Lock` for rate limiting. This design has fundamental limitations:

Evidence:

- The rate limit state is per-process. In a multi-worker deployment (gunicorn, k8s pods), each worker maintains independent state, making limits ineffective.
- The `_lock` is an `asyncio.Lock`, which only protects within a single event loop.
- There is no persistence or external store integration.
- The cleanup logic runs inline during request processing, adding latency.
- The middleware extends `BaseHTTPMiddleware`, which is known to have issues with streaming responses and adds overhead.

### Impact

- Rate limiting is effectively absent in any multi-process deployment.
- Memory grows unbounded if cleanup intervals are missed.
- The `BaseHTTPMiddleware` pattern can cause subtle bugs with streaming and large responses.

### Proposed Direction

- Abstract the rate limit store behind an interface (`RateLimitStore` protocol).
- Provide two implementations: in-memory (for single-process dev) and Redis (for production).
- Migrate from `BaseHTTPMiddleware` to pure ASGI middleware (following the pattern already established in `DeprecationMiddleware`).
- Make the store backend configurable via `settings.RATE_LIMIT_BACKEND`.

### Affected Files

- `backend/core/middleware/rate_limit.py`
- `backend/config/settings.py`

---

## Issue 4: RequestLoggingMiddleware Duplicates Error Handling

### Problem

`RequestLoggingMiddleware` in `backend/core/middleware/logging.py` catches all exceptions and returns a manually constructed JSON error response. This duplicates the error handling already done by the registered exception handlers in `backend/api/_exceptions.py`.

Evidence:

- The middleware's `dispatch()` method catches `Exception` and builds a `JSONResponse` with `detail`, `code`, and `timestamp`.
- The `register_exception_handlers()` function in `_exceptions.py` also catches `Exception` and builds a similar response via `error_payload()`.
- Both produce the same shape, but the middleware version has a `DEBUG`-conditional detail that the exception handler does not.
- The middleware also extends `BaseHTTPMiddleware`, which executes before the exception handlers, meaning the middleware's catch block can shadow the registered handlers.

### Impact

- Two different code paths can produce error responses for the same exception, leading to subtle inconsistencies.
- The `DEBUG`-conditional detail leak in the middleware is a potential information disclosure risk that bypasses the centralized handler.
- Future changes to error payload shape must be synchronized across two locations.

### Proposed Direction

- Remove exception handling from `RequestLoggingMiddleware`. Let it only log the request/response and propagate exceptions to the registered handlers.
- If request-scoped error logging is needed, add it to the exception handlers instead.
- Migrate from `BaseHTTPMiddleware` to pure ASGI middleware.

### Affected Files

- `backend/core/middleware/logging.py`
- `backend/api/_exceptions.py`

---

## Issue 5: Repository Commit Semantics Are Inconsistent

### Problem

`BaseRepository` always commits on `create`, `update`, and `delete`. `SkillRepository` overrides these methods to add a `commit: bool = True` parameter. `UserRepository` overrides `create` and `update` without the `commit` parameter, always committing. This inconsistency creates subtle transaction boundary bugs.

Evidence:

- `BaseRepository.create()` always commits.
- `SkillRepository.create()` accepts `commit: bool = True` and conditionally commits.
- `SkillRepository.update()` accepts `commit: bool = True` and conditionally commits.
- `UserRepository.create()` always commits (no `commit` parameter).
- `UserRepository.update()` always commits (no `commit` parameter).
- `SkillCloneService.create_clone()` relies on `commit=False` to build a multi-step transaction, then manually calls `session.commit()`.
- `SkillUploadCoordinator` relies on `commit=True` (default) for individual operations.

### Impact

- It is impossible to compose multi-step operations in `UserRepository` without manual session management.
- The `commit` parameter on `SkillRepository` leaks transaction management into the service layer.
- New developers cannot predict whether a repository call will commit without reading the specific override.

### Proposed Direction

- Standardize on a Unit of Work pattern: repositories should `flush` by default, not `commit`.
- Introduce a `UnitOfWork` context manager that handles commit/rollback at the service or route level.
- Remove the `commit` parameter from all repository methods.
- For backward compatibility, provide a `commit` flag on the `UnitOfWork` rather than on individual repository calls.

### Affected Files

- `backend/repositories/base.py`
- `backend/repositories/skill.py`
- `backend/repositories/user.py`
- `backend/repositories/token.py`
- `backend/repositories/audit_log.py`
- `backend/repositories/skill_version.py`
- `backend/services/skill_clone.py`
- `backend/services/skill_upload.py`
- `backend/services/skill_lifecycle.py`

---

## Issue 6: Dependency Injection Is Manual and Repetitive

### Problem

Service and repository construction is done manually in every route handler via `build_skill_service(session)` or `XxxRepository(session)`. There is no centralized dependency injection container, leading to:

Evidence:

- `build_skill_service(session)` constructs `SkillService(SkillRepository(session), SkillVersionRepository(session))` — a 3-object graph that is rebuilt on every request.
- `AuthService(UserRepository(session))` is constructed inline in `auth.py` route handlers.
- `TokenService(TokenRepository(session), UserRepository(session))` is constructed inline in `tokens.py`.
- `AuditService(AuditLogRepository(session))` is constructed inline at every audit call site.
- `UserService(UserRepository(session))` is constructed inline in `users.py`.
- `VerificationCodeService` is constructed via `get_verification_service(session)` which is a module-level factory function.

### Impact

- Adding a new dependency to any service requires changing every call site.
- Constructor signatures are duplicated across route files.
- Testing requires manual mock wiring at every construction site.
- No single place to see the full dependency graph.

### Proposed Direction

- Introduce a lightweight DI container or use FastAPI's `Depends` system more systematically.
- Define provider functions for each service that declare their dependencies via `Depends()`:
  ```python
  async def get_skill_service(session=Depends(get_async_session)) -> SkillService:
      return SkillService(SkillRepository(session), SkillVersionRepository(session))
  ```
- Route handlers then use `service=Depends(get_skill_service)` instead of manual construction.
- This also makes it trivial to swap implementations for testing.

### Affected Files

- `backend/api/v1/skills.py`
- `backend/api/v1/auth.py`
- `backend/api/v1/users.py`
- `backend/api/v1/tokens.py`
- `backend/api/v1/dashboard.py`
- `backend/api/v1/audit.py`
- `backend/api/v1/client_skills.py`
- `backend/api/v1/skills_support/service_factory.py`

---

## Issue 7: Visibility Validation Is Scattered and Duplicated

### Problem

The set of valid visibility values (`private`, `team`, `enterprise`) is validated independently in at least three places, with no shared constant or validator.

Evidence:

- `backend/services/skill_lifecycle.py` line ~147: `if visibility_value not in {"private", "team", "enterprise"}:`
- `backend/services/skill_lifecycle.py` line ~170: `if normalized not in {"private", "team", "enterprise"}:`
- `backend/services/skill_upload.py` line ~219: `if visibility_value not in {"private", "team", "enterprise"}:`
- `backend/core/security/rbac.py` line ~49: checks for `"public"`, `"enterprise"`, `"team"` as separate string literals.
- `backend/repositories/skill.py` line ~46: `Skill.visibility == "public"` as a raw string literal.

Note: The enum-catalog-consolidation plan addresses the broader question of how to author and share these values, but the immediate duplication risk is a separate code hygiene issue.

### Impact

- Adding a new visibility value requires finding and updating all 5+ locations.
- The `"public"` visibility value is used in read paths but excluded from write-path validation, and this distinction is implicit.
- Typos in visibility strings would silently create invalid data.

### Proposed Direction

- Define `EDITABLE_VISIBILITIES = frozenset({"private", "team", "enterprise"})` and `READ_VISIBILITIES = EDITABLE_VISIBILITIES | {"public"}` in `backend/domain/` or `backend/core/`.
- Replace all inline set literals with references to these constants.
- Add a Pydantic validator on the schema layer that uses the same constants.

### Affected Files

- `backend/services/skill_lifecycle.py`
- `backend/services/skill_upload.py`
- `backend/core/security/rbac.py`
- `backend/repositories/skill.py`

---

## Issue 8: SSO Nonce Validation Is Duplicated Between AuthService and SSOOIDCService

### Problem

SSO nonce and timestamp validation logic exists in two separate places with overlapping but not identical implementations.

Evidence:

- `backend/services/auth.py` `login_sso()` method validates nonce, `iat`, and `exp` directly.
- `backend/services/sso_oidc.py` `validate_nonce_and_timestamps()` performs the same validations with the same logic.
- `backend/api/v1/auth.py` `sso_callback()` calls `oidc_service.validate_nonce_and_timestamps()` after already having the OIDC service decode the token.
- The `auth.py` `login_sso()` path (used for direct JWT SSO without OIDC flow) duplicates the nonce/timestamp checks that the OIDC callback path delegates to `SSOOIDCService`.

### Impact

- Bug fixes to nonce/timestamp validation must be applied in two places.
- The two implementations could drift over time, creating security inconsistencies.
- It is unclear which is the canonical validation path.

### Proposed Direction

- Make `SSOOIDCService.validate_nonce_and_timestamps()` the single source of truth for nonce and timestamp validation.
- Refactor `AuthService.login_sso()` to delegate to the same validation function.
- If `AuthService` needs to work without `SSOOIDCService`, extract the validation into a shared utility in `backend/core/security/`.

### Affected Files

- `backend/services/auth.py`
- `backend/services/sso_oidc.py`

---

## Issue 9: Email Sender Selection Logic Is Fragile

### Problem

`get_email_sender()` in `backend/services/email_sender.py` selects between `SmtpEmailSender` and `AliyunEmailSender` based on `settings.DEBUG`. This is a fragile heuristic that does not reflect actual configuration intent.

Evidence:

- `if settings.DEBUG: return SmtpEmailSender(...)` — DEBUG mode is not the same as "use SMTP for email".
- Production deployments that want to use SMTP (e.g., self-hosted email) cannot do so without enabling DEBUG.
- The function is called at runtime on every invocation (via `get_email_sender()` in `verification_code.py`), creating a new sender instance each time.
- There is no way to add a third email backend without modifying this function.

### Impact

- Production SMTP users are forced to choose between DEBUG mode and their email provider.
- The `DEBUG` flag conflates debugging behavior with infrastructure selection.
- No extensibility for additional email providers.

### Proposed Direction

- Add `EMAIL_PROVIDER` setting with values like `"smtp"`, `"aliyun"`, `"console"` (for dev).
- Select the sender based on `EMAIL_PROVIDER`, not `DEBUG`.
- Consider caching the sender instance (it is stateless after construction).

### Affected Files

- `backend/services/email_sender.py`
- `backend/config/settings.py`

---

## Issue 10: Skill Upload Flow Has Significant Code Duplication

### Problem

`SkillUploadCoordinator.upload_zip_from_path()` and `SkillUploadCoordinator.upload_zip_create_skill_from_path()` share approximately 70% identical logic for archive validation, version derivation, file extraction, content hashing, and version record creation.

Evidence:

- Both methods: validate the zip archive, read frontmatter, derive version, compute dependencies, create version directory, extract files, compute content hash, sync to current dir, create version record, update skill, persist archive.
- The main difference is that `upload_zip_create_skill_from_path` also creates the skill record and handles orphan version detection.
- The same duplication exists in the `upload_zip()` / `upload_zip_create_skill()` byte-content entry points.

### Impact

- Bug fixes to the upload pipeline must be applied in two places.
- The two paths can drift, leading to inconsistent behavior.
- Adding new upload features (e.g., new dependency spec formats) requires double the work.

### Proposed Direction

- Extract the shared upload pipeline into a private method (e.g., `_process_upload_archive()`).
- `upload_zip_from_path` and `upload_zip_create_skill_from_path` should call the shared pipeline after their specific pre-processing (skill lookup vs. skill creation).
- Consider a `UploadContext` dataclass that carries the pre-processed state into the shared pipeline.

### Affected Files

- `backend/services/skill_upload.py`

---

## Issue 11: BaseHTTPMiddleware Usage in Multiple Middlewares

### Problem

Three middleware classes extend `BaseHTTPMiddleware`:

- `RequestLoggingMiddleware` (`backend/core/middleware/logging.py`)
- `RateLimitMiddleware` (`backend/core/middleware/rate_limit.py`)

`DeprecationMiddleware` already uses pure ASGI, demonstrating the team is aware of the issue.

`BaseHTTPMiddleware` is known to have problems:

- It wraps the response in a way that breaks streaming.
- It adds overhead by buffering the response body.
- Starlette documentation recommends pure ASGI middleware for production use.

### Impact

- Streaming responses (e.g., large file downloads) may not work correctly.
- Unnecessary memory overhead from response buffering.
- Inconsistent middleware patterns across the codebase.

### Proposed Direction

- Migrate `RequestLoggingMiddleware` and `RateLimitMiddleware` to pure ASGI middleware, following the pattern established in `DeprecationMiddleware`.
- This should be done in conjunction with Issue 3 (rate limiter refactor) and Issue 4 (logging middleware cleanup).

### Affected Files

- `backend/core/middleware/logging.py`
- `backend/core/middleware/rate_limit.py`

---

## Issue 12: `require_permission()` Uses Raw String Literals Instead of Permission Constants

### Problem

Most route handlers use `require_permission("skill.list")` with raw string literals instead of the `Permission` constants defined in `backend/core/permissions.py`.

Evidence:

- `backend/api/v1/skills.py`: uses `require_permission("skill.list")`, `require_permission("skill.create")`, etc.
- `backend/api/v1/auth.py`: does not use `Permission` constants.
- `backend/api/v1/dashboard.py`: uses `require_permission(Permission.DASHBOARD_READ)` — this is the correct pattern.
- The `Permission` class already exists with all the constants and convenience methods.

### Impact

- Typos in permission strings will not be caught at compile time.
- Refactoring permission names requires finding all string literals.
- Defeats the purpose of having centralized `Permission` constants.

### Proposed Direction

- Replace all raw string permission literals with `Permission.XXX` constants.
- Add a lint rule or test that verifies no raw permission strings exist in route files.

### Affected Files

- `backend/api/v1/skills.py`
- `backend/api/v1/auth.py`
- `backend/api/v1/client_skills.py`

---

## Priority Matrix

| Issue | Severity | Effort | Risk if Deferred | Recommended Order |
|-------|----------|--------|------------------|-------------------|
| 1. SkillService god-class | High | Medium | Increases with every new feature | 2 |
| 2. Audit coupling | Medium | Medium | Inconsistent audit trails | 4 |
| 3. Rate limiter | High | Medium | Security gap in multi-worker deploys | 1 |
| 4. Logging middleware duplication | Medium | Low | Error response inconsistency | 6 |
| 5. Repository commit semantics | High | High | Transaction boundary bugs | 3 |
| 6. Manual DI | Medium | Medium | Boilerplate, testing friction | 5 |
| 7. Visibility validation scatter | Medium | Low | Silent data corruption | 7 |
| 8. SSO nonce duplication | Medium | Low | Security drift | 8 |
| 9. Email sender selection | Low | Low | Misconfiguration in production | 10 |
| 10. Upload flow duplication | Medium | Medium | Bug fix drift | 9 |
| 11. BaseHTTPMiddleware | Medium | Medium | Streaming bugs | Concurrent with 3, 4 |
| 12. Raw permission strings | Low | Low | Refactoring friction | 11 |

## Proposed Delivery Batches

### Batch A: Security and Infrastructure (Issues 3, 4, 11)

These are tightly coupled: the rate limiter and logging middleware both use `BaseHTTPMiddleware` and both need ASGI migration. Fixing them together avoids double rewrites.

### Batch B: Architecture Simplification (Issues 1, 5, 6)

SkillService decomposition, repository commit semantics, and DI container are interdependent. The DI container makes SkillService decomposition cleaner, and the Unit of Work pattern makes repository commit semantics consistent. Address them as a coordinated batch.

### Batch C: Consistency and Hygiene (Issues 2, 7, 8, 12)

Audit coupling, visibility constants, SSO nonce consolidation, and permission constants are lower-risk, lower-effort changes that improve code hygiene without architectural shifts.

### Batch D: Feature-Level Refactoring (Issues 9, 10)

Email sender selection and upload flow deduplication are self-contained improvements that can be done independently.

## Validation

After each batch:

1. `uv run pytest` — all existing tests pass.
2. `uv run ruff check .` — no new lint issues.
3. `uv run mypy backend` — no new type errors.
4. `python scripts/validate_agents_docs.py --level ERROR` — documentation stays consistent.
5. Update `docs/exec-plans/tech-debt-tracker.md` with resolved items.
