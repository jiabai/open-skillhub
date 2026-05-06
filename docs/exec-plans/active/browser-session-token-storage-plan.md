# Browser Session Token Storage Plan

Status: Draft for Review
Updated: 2026-05-06

This ExecPlan is a living document. The sections Progress, Surprises &
Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date
as work proceeds.

Product spec: `docs/product-specs/2026-05-06-browser-session-token-storage.md`
Design doc: `docs/design-docs/browser-session-token-storage.md`
Task checklist: `docs/exec-plans/active/browser-session-token-storage-tasks.md`

## Purpose / Big Picture

The browser console should not persist reusable bearer tokens in storage that
JavaScript can read, or in URLs. Web sessions should use a hardened refresh
boundary, while frontend API helpers continue to obtain short-lived access
credentials in a controlled way.

This plan should run after, or in close coordination with, refresh-token
hardening so the backend has server-side refresh-session state before the
frontend stops persisting refresh tokens.

## Progress

- [x] (2026-05-06) Record the debt and create product spec, design doc,
  execution plan, and task checklist.
- [ ] Confirm final browser session mechanism and cookie/CSRF policy.
- [ ] Add failing frontend tests for absence of durable token storage.
- [ ] Add failing backend tests for cookie session flags, refresh, logout, and
  CSRF or origin checks.
- [ ] Implement backend browser-session cookie helpers and refresh/logout paths.
- [ ] Refactor frontend session handling away from `localStorage` token pairs.
- [ ] Remove token-pair SSO redirect fragments from browser callback flow.
- [ ] Run frontend, backend, and documentation gates.
- [ ] Archive the completed plan and task checklist.

## Surprises & Discoveries

- `frontend/src/lib/api.ts` contains an explicit security warning for
  localStorage token persistence and still owns token storage, refresh retry,
  upload retry, and API error mapping in one module.
- `backend/api/v1/auth.py` returns token pairs from several auth paths and puts
  SSO tokens into the frontend URL fragment today.

## Decision Log

- Decision: Track browser session storage separately from refresh-token
  rotation.
  Rationale: Rotation hardening does not remove the durable
  JavaScript-readable storage or URL-fragment exposure of token material.
  Date/Author: 2026-05-06 / Codex

- Decision: Prefer HttpOnly refresh cookie plus memory-only access token for
  the first implementation batch.
  Rationale: It removes the most durable browser-side secret while avoiding a
  full migration of every authenticated API call to cookie auth.
  Date/Author: 2026-05-06 / Codex

## Outcomes & Retrospective

Not started. This plan is ready for review before implementation.

## Context and Orientation

Current anchors:

| File | Current role |
|------|--------------|
| `frontend/src/lib/api.ts` | Stores token pairs, refreshes tokens, attaches access tokens, and retries uploads |
| `frontend/src/app/sso/callback/page.tsx` | Consumes SSO callback result from the browser redirect |
| `backend/api/v1/auth.py` | Issues token pairs, refreshes tokens, logs out users, and handles SSO callback redirects |
| `backend/services/auth.py` | Issues and refreshes backend JWT pairs |
| `backend/core/security/jwt_utils.py` | Creates and decodes access and refresh JWTs |
| `tests/test_api_auth.py` | Backend auth API regression coverage |
| `frontend/src/__tests__/pages.test.tsx` | Broad frontend page and flow regression coverage |

Likely new or changed anchors:

| File | Expected role |
|------|---------------|
| `frontend/src/lib/session.ts` | Browser session owner for memory-only access token and guarded refresh |
| `frontend/src/lib/api.ts` | API helper consumer of the session boundary instead of token storage owner |
| `tests/test_browser_session_tokens.py` | Focused backend cookie and CSRF behavior tests, if backend coverage is split |
| `frontend/src/lib/session.test.ts` | Focused frontend storage and refresh behavior tests, if frontend coverage is split |

## Plan of Work

### Phase 1: Finalize Session Contract

Document the exact cookie attributes, same-site mode, CSRF or origin policy, and
compatibility expectations for any existing JSON refresh-token payload support.
Coordinate with the refresh-token hardening plan before changing production
token issuance.

### Phase 2: Failing Tests

Add tests that prove:

1. Web login does not persist token pairs in localStorage or sessionStorage.
2. App boot can recover an access token through the browser refresh boundary.
3. Refresh retry reuses the in-memory access token flow and not a stored refresh
   token.
4. Logout clears the browser session cookie and memory state.
5. SSO callback does not receive token pairs in the URL fragment.
6. Cookie-authenticated refresh/logout reject missing or invalid CSRF/origin
   context when applicable.

### Phase 3: Backend Browser Session Boundary

Add shared helpers for setting and clearing the browser refresh cookie. Update
login, registration, LDAP login, SSO callback, refresh, and logout paths as
needed while preserving explicit API-token workflows.

### Phase 4: Frontend Session Refactor

Extract frontend session ownership from `frontend/src/lib/api.ts`. Keep access
tokens in memory, request refresh through the browser session boundary, and make
API/upload helpers call the session provider instead of reading localStorage.

### Phase 5: SSO Callback Cleanup

Replace token-fragment redirect handling with a non-secret success marker or a
one-time callback completion code. Remove callback code that parses reusable
access or refresh tokens from the URL.

### Phase 6: Validation And Archive

Run focused tests during implementation, then frontend, backend, and
documentation gates before archiving this plan and its task checklist.

## Validation and Acceptance

Focused validation:

```bash
cd frontend && npm test -- --runInBand
uv run pytest tests/test_api_auth.py -v
```

Full gates:

```bash
cd frontend && npm run lint
cd frontend && npm test
cd frontend && npm run build
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```

Acceptance:

- Browser sessions do not persist reusable token pairs in localStorage,
  sessionStorage, or SSO URL fragments.
- Refresh and logout work through an explicit browser session boundary.
- Cookie-authenticated auth paths have documented and tested CSRF protections.
- Existing API-token workflows remain available for automation clients.
