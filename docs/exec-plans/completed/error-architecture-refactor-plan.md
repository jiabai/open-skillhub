# Error Architecture Refactor Plan

## Goal

Replace the current mix of string-based service errors, duplicated router mappings, and transport-specific payload helpers with a single error architecture.

The target state is:

- domain and service layers emit canonical error semantics
- HTTP and tool transports render those semantics through dedicated adapters
- router modules no longer duplicate verification error maps
- error payload shape stays consistent across the application

## Current Problems

### 1. Verification error mapping is duplicated

These two modules currently maintain the same mapping logic:

- `backend/api/v1/auth.py`
- `backend/api/v1/users.py`

Both define:

- `_verification_error_messages`
- `_verification_error_payload()`

This creates drift risk and spreads protocol formatting across routers.

### 2. Service/domain layers still rely on stringly-typed errors

Verification-related flows currently rely on magic string values such as:

- `CODE_EXPIRED`
- `CODE_INVALID`
- `TOO_MANY_ATTEMPTS`
- `RESEND_TOO_FREQUENT`

This is not a stable domain contract. It couples internal control flow to transport-layer formatting logic.

### 3. Error payload formatting is split by transport without a shared model

Current payload construction is split across:

- `backend/api_app.py`
- `backend/core/utils/skill_storage.py`

This is not literally the same helper duplicated everywhere, but the underlying error model is still not centralized.

## Design Principles

### 1. Domain errors must be transport-agnostic

Service and domain code should express:

- what failed
- why it failed
- whether the failure is expected

They should not decide:

- HTTP payload shape
- JSON serialization details
- user-facing transport formatting

### 2. Error code and human message must be separate concerns

Each canonical error should have:

- a stable machine-readable `code`
- a default human-readable `detail`

This allows future localization or frontend-side translation without destabilizing backend contracts.

### 3. HTTP and tool responses should share one semantic source

HTTP responses may need:

- `detail`
- `code`
- `timestamp`

Tool responses may need:

- serialized JSON string payload

They should differ only at the adapter layer, not in their underlying semantic representation.

## Target Architecture

### 1. Canonical error codes

Extend the existing public error module:

- `backend/core/errors.py`

Purpose:

- define stable application error codes
- avoid repeating raw strings in services and routers

Implementation note:

- The repository already imports `backend.core.errors` as a module from routes,
  exception handlers, and utility adapters. Do not convert it into a package in
  this pass; keep the existing import surface stable and add canonical codes,
  domain exceptions, and presenter helpers inside the current module.

Suggested structure:

```python
class ErrorCode:
    BAD_REQUEST = "BAD_REQUEST"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"

    CODE_EXPIRED = "CODE_EXPIRED"
    CODE_INVALID = "CODE_INVALID"
    TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS"
    RESEND_TOO_FREQUENT = "RESEND_TOO_FREQUENT"

    INACTIVE_USER = "INACTIVE_USER"
```

### 2. Canonical domain exceptions

Extend:

- `backend/core/errors.py`

Purpose:

- define the internal error contract used by services

Suggested structure:

```python
class AppError(Exception):
    code: str
    detail: str
    status_code: int


class VerificationError(AppError):
    pass


class CodeExpiredError(VerificationError):
    ...
```

Requirements:

- each exception carries `code`
- each exception carries default `detail`
- each exception carries intended HTTP `status_code`

### 3. Transport presenters

Extend:

- `backend/core/errors.py`

Purpose:

- render canonical errors for specific transports

Suggested functions:

- `build_error_payload(detail: object, code: str, *, timestamp: str | None = None) -> dict`
- `build_http_error_detail(error: AppError) -> dict`
- `build_tool_error_payload(error: AppError | None = None, *, detail: object | None = None, code: str | None = None) -> str`

Requirements:

- one canonical payload structure
- HTTP returns `dict`
- tool returns JSON string
- timestamp generation stays centralized

## File-Level Refactor Plan

### A. Refactor verification service to raise canonical exceptions

Modify:

- `backend/services/verification_code.py`

Replace string-based raises with canonical exceptions:

- `CodeExpiredError`
- `CodeInvalidError`
- `TooManyAttemptsError`
- `ResendTooFrequentError`

This is the core domain boundary change.

### B. Remove duplicated router verification mappings

Modify:

- `backend/api/v1/auth.py`
- `backend/api/v1/users.py`

Delete:

- `_verification_error_messages`
- `_verification_error_payload()`

Replace with:

- exception handling for canonical verification exceptions
- shared presenter calls

Target pattern:

```python
except VerificationError as exc:
    raise HTTPException(
        status_code=exc.status_code,
        detail=build_http_error_detail(exc),
    ) from exc
```

### C. Centralize HTTP payload handling in `api_app.py`

Modify:

- `backend/api_app.py`

Keep responsibility limited to:

- adding timestamp to structured details
- mapping generic HTTP status codes to default codes
- catching unhandled exceptions

Do not let `api_app.py` become a business error dictionary.

### D. Move tool payload construction onto the same presenter layer

Modify:

- `backend/core/utils/skill_storage.py`

Change `tool_error_payload()` so that it delegates to the canonical presenter layer instead of manually building a JSON object.

This keeps transport differences at the adapter level only.

## Proposed Delivery Order

### Phase 1. Establish the error foundation

Extend:

- `backend/core/errors.py`

Keep compatibility wrappers for existing call sites:

- `error_payload()`
- `error_payload_from_exception()`
- `error_payload_json()`
- `verification_error_payload()`

### Phase 2. Move verification flows to canonical exceptions

Refactor:

- `backend/services/verification_code.py`

### Phase 3. Remove duplicated router mappings

Refactor:

- `backend/api/v1/auth.py`
- `backend/api/v1/users.py`

### Phase 4. Align transport adapters

Refactor:

- `backend/api_app.py`
- `backend/core/utils/skill_storage.py`

### Phase 5. Add regression coverage

Add or update tests so the new architecture is locked in.

## Test Strategy

### 1. Service-layer tests

Verification service tests should assert:

- canonical exception type
- canonical code
- canonical default detail

They should no longer assert on raw string exceptions.

### 2. Router tests

HTTP tests should assert that both auth and users endpoints return the same structured payload for the same verification failure.

Required checks:

- same `code`
- same `detail`
- expected HTTP status

### 3. Transport consistency tests

Add tests that compare:

- HTTP payload detail/code
- tool payload detail/code

They do not need the same Python type, but they should express the same semantic content.

### 4. Exception envelope tests

`api_app.py` tests should assert:

- structured `detail` payloads get `timestamp`
- canonical `code` survives exception handling
- unknown exceptions still fall back to `INTERNAL_SERVER_ERROR`

## Non-Goals

This refactor does not need to:

- redesign every business exception in the entire backend in one pass
- localize all backend error messages
- replace every `ValueError` in the codebase immediately

The first boundary to fix is verification-related errors plus the shared payload model.

## Done Definition

This refactor is complete when:

- verification flows no longer use raw string exceptions as their primary contract
- auth and users routers no longer duplicate verification error maps
- HTTP and tool error payloads are rendered from one canonical presenter layer
- error code and detail are consistently structured across transports
- regression tests lock in the new behavior

## Execution Checklist

- [ ] Extend `backend/core/errors.py` with canonical codes, application errors,
      verification-specific exceptions, and presenter helpers while preserving
      existing public helpers.
- [ ] Refactor `backend/services/verification_code.py` to raise canonical
      verification exceptions instead of raw string `ValueError`s.
- [ ] Refactor `backend/api/v1/auth.py` and `backend/api/v1/users.py` to catch
      `VerificationError` and delegate payload rendering to shared presenters.
- [ ] Refactor `backend/core/utils/skill_storage.py` to keep `tool_error_payload()`
      as the tool adapter while delegating serialization to the shared presenter.
- [ ] Update focused backend tests for service exceptions, HTTP envelope behavior,
      router consistency, and tool payload consistency.
- [ ] Run backend/documentation gates and record the results here before archiving.

## Decisions

- 2026-05-05: Keep `backend.core.errors` as a single module for this pass instead
  of creating `backend/core/errors/` package files, because existing code already
  imports `backend.core.errors` directly. This preserves the import boundary and
  keeps the refactor focused on semantics rather than module migration.
- 2026-05-05: Verification-specific canonical exceptions are in scope; replacing
  all other backend `ValueError` paths remains out of scope for this refactor.
- 2026-05-05: Tool error output remains a JSON string adapter, but the payload
  shape must be produced by the same presenter source as HTTP structured details.
- 2026-05-05: `backend/api_app.py` already delegates exception shaping to
  `backend/api/_exceptions.py`; no direct app-factory change was needed because
  the existing exception handlers already call the shared `backend.core.errors`
  helpers.

## Progress

- [x] Reviewed `WORKFLOW.md`, `docs/EXECUTION_GATES.md`, backend guidance, and
      constitution docs for this backend architecture change.
- [x] Reviewed the current error, verification, router, exception-handler, and
      tool-storage code paths before editing implementation files.
- [x] Updated this plan to match the existing `backend/core/errors.py` import
      surface and to add explicit execution, decision, and validation tracking.
- [x] Implement canonical error helpers and verification exceptions.
- [x] Refactor service/router/tool adapters.
- [x] Update regression tests.
- [x] Run validation gates.
- [x] Archive completed plan and update indexes.

## Validation Log

- 2026-05-05: Red check confirmed the new tests failed before implementation:
  `uv run pytest tests/test_error_presenters.py tests/test_verification_code_extended.py::TestVerificationCodeServiceSend::test_send_code_resend_too_frequent tests/test_verification_code_extended.py::TestVerificationCodeServiceVerify::test_verify_code_not_found tests/test_users_api.py::TestUsersAPIErrorHandling::test_delete_me_invalid_code_returns_structured_verification_error`
  failed on missing canonical error imports.
- 2026-05-05: Focused regression check passed:
  `uv run pytest tests/test_error_presenters.py tests/test_verification_code_extended.py::TestVerificationCodeServiceSend::test_send_code_resend_too_frequent tests/test_verification_code_extended.py::TestVerificationCodeServiceVerify::test_verify_code_not_found tests/test_users_api.py::TestUsersAPIErrorHandling::test_delete_me_invalid_code_returns_structured_verification_error`
  passed with 6 tests.
- 2026-05-05: Related backend check passed:
  `uv run pytest tests/test_error_presenters.py tests/test_core_errors.py tests/test_verification_code_extended.py tests/test_api_auth.py tests/test_users_api.py tests/test_skill_support.py`
  passed with 60 tests.
- 2026-05-05: Backend hard gates passed:
  `uv run ruff check .`, `uv run mypy backend`, and `uv run pytest` passed
  with 638 tests.
- 2026-05-05: Documentation hard gate passed:
  `python scripts/validate_agents_docs.py --level ERROR` reported 0 errors and
  0 warnings.

## Follow-Up Notes

- If a later task wants a multi-file `backend/core/errors/` package, handle it as
  a separate migration with explicit import-compatibility checks.

## One-Line Summary

The correct fix is not “extract a helper”, but to establish a proper error architecture:

- canonical error codes
- canonical domain exceptions
- transport-specific presenters for HTTP and tool output
