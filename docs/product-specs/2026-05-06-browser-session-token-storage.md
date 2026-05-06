# Browser Session Token Storage

Date: 2026-05-06
Status: Draft for Review

Related:

- `docs/design-docs/browser-session-token-storage.md`
- `docs/exec-plans/active/browser-session-token-storage-plan.md`
- `docs/exec-plans/active/browser-session-token-storage-tasks.md`
- `docs/product-specs/2026-05-06-refresh-token-hardening.md`

## Problem

The web console currently stores access and refresh tokens in
`window.localStorage` through `frontend/src/lib/api.ts`. That makes browser
session bearer tokens readable by any successful XSS payload. The current SSO
callback path also redirects token pairs through the URL fragment before the
frontend stores them.

`2026-05-06-refresh-token-hardening.md` intentionally hardens refresh-token
rotation semantics without changing the frontend storage mechanism, so browser
session storage needs its own executable work package.

## Goal

Browser sign-in should keep session credentials out of durable JavaScript-readable
storage and out of URLs while preserving the existing user-facing login,
registration, SSO, LDAP, logout, and authenticated API workflows.

## Scope

- Web console session storage and refresh behavior.
- Backend auth endpoints needed to issue, refresh, and clear browser sessions.
- SSO callback behavior for browser sessions.
- CSRF, CORS, and cookie semantics introduced by browser session credentials.
- Frontend and backend tests that prove tokens are no longer persisted in
  `localStorage`, `sessionStorage`, or URL fragments for web sessions.

## Non-Goals

- Changing API-token behavior for automation clients.
- Changing desktop-client session behavior.
- Replacing all bearer-token API contracts in one batch.
- Treating this as a complete XSS remediation project. CSP and UI sanitization
  can be tracked separately if code review finds concrete gaps.

## User Experience

- Existing login, registration, LDAP login, SSO login, logout, and 401 refresh
  retry behavior should remain recognizable to users.
- A normal browser refresh should keep a valid session alive when the server-side
  refresh session is still valid.
- Logging out should clear server-side browser session state and leave no
  reusable credential in browser storage.

## Acceptance Criteria

- Web session token pairs are not written to `localStorage` or `sessionStorage`.
- Web session token pairs are not passed back to the frontend in URL fragments.
- The browser refresh credential is stored in an `HttpOnly`, `Secure`,
  `SameSite` cookie or another documented non-JavaScript-readable mechanism.
- Any JavaScript-readable access token is memory-only and can be recovered through
  a guarded refresh flow after page reload.
- Cookie-authenticated refresh and logout paths have explicit CSRF protection
  through `SameSite`, origin checks, CSRF tokens, or a documented combination.
- API-token management remains available for automation clients.
- Tests cover login, refresh retry, app reload recovery, logout clearing, SSO
  callback handling, and the absence of durable browser token storage.
