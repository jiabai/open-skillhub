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

Add:

- `backend/core/errors/codes.py`

Purpose:

- define stable application error codes
- avoid repeating raw strings in services and routers

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

Add:

- `backend/core/errors/exceptions.py`

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

Add:

- `backend/core/errors/presenters.py`

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

Create:

- `backend/core/errors/codes.py`
- `backend/core/errors/exceptions.py`
- `backend/core/errors/presenters.py`

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

## One-Line Summary

The correct fix is not “extract a helper”, but to establish a proper error architecture:

- canonical error codes
- canonical domain exceptions
- transport-specific presenters for HTTP and tool output
