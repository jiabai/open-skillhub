# Browser Session Token Storage Design

Status: Proposed
Updated: 2026-05-06

## Context

`frontend/src/lib/api.ts` currently owns token persistence, refresh retries, API
fetch wrappers, upload helpers, and user-facing API error mapping. The same file
has an inline security warning that localStorage token persistence is vulnerable
to XSS.

`backend/api/v1/auth.py` returns token pairs from login, registration, refresh,
LDAP login, and SSO callback flows. The SSO callback currently redirects the
frontend with access and refresh tokens in the URL fragment. That avoids sending
tokens to the server in query strings but still exposes token material to
browser history surfaces, extensions, client-side scripts, screenshots, and
crash or support logs.

Refresh-token rotation hardening remains necessary, but it does not remove the
browser storage risk by itself. A stolen refresh token from localStorage can
still be reused before rotation hardening detects compromise.

## Decision

Use a browser-specific session boundary:

- Store the browser refresh credential in an `HttpOnly`, `Secure`, `SameSite`
  cookie scoped as narrowly as the backend auth routes allow.
- Keep any JavaScript-readable access token in memory only. On app boot, recover
  an access token through a guarded refresh endpoint if the refresh cookie is
  valid.
- Make the frontend session module the only owner of web session state. API,
  client API, and upload helpers should request access tokens through that
  boundary instead of reading storage directly.
- Do not put token pairs in SSO redirect fragments. Prefer a server-set browser
  session cookie plus a success redirect, or a short-lived one-time callback
  completion code that is exchanged without exposing reusable credentials in the
  URL.
- Protect cookie-authenticated refresh and logout paths against CSRF. `SameSite`
  should be configured deliberately, and cross-site deployments should add an
  explicit CSRF token or strict origin checks.
- Keep API-token workflows separate from browser session credentials.

## Alternatives Considered

### Keep localStorage token pairs

Rejected. It preserves the current XSS token-exfiltration risk and contradicts
the warning already present in the code.

### Store both access and refresh tokens only in memory

Rejected as the default because it would sign users out on every page reload.
Memory-only access tokens are acceptable when paired with a refresh boundary
that JavaScript cannot read.

### Put both access and refresh tokens in cookies

Possible, but it would shift every authenticated API call to cookie auth and
increase CSRF surface area. The first batch should minimize API contract churn by
using a cookie refresh credential and memory-only access token.

## Implementation Notes

- Backend login, registration, LDAP, and SSO browser flows should set or refresh
  the session cookie through a common helper so cookie flags cannot drift.
- Refresh should accept the cookie for browser sessions and may keep the JSON
  refresh-token body for compatibility only if the security model still needs it.
- Logout should clear the cookie and revoke server-side refresh state.
- Frontend code should stop exporting general `storeTokens()` behavior for web
  sessions. Test helpers can use a narrow session test seam if needed.
- SSO callback pages should consume only a non-secret success marker or one-time
  code and should not parse token pairs from fragments after migration.
- The design should be sequenced with refresh-token hardening so server-side
  refresh state exists before durable browser storage is removed.

## Validation Strategy

- Frontend tests assert login and refresh flows do not call
  `localStorage.setItem()` or `sessionStorage.setItem()` with token payloads.
- Frontend tests assert SSO callback handling does not require token fragments.
- Backend tests assert cookie flags, refresh-cookie use, logout cookie clearing,
  CSRF or origin protection, and compatibility behavior for non-browser token
  paths that remain supported.
- A focused integration test covers page reload recovery through the refresh
  cookie.
