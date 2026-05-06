# Browser Session Token Storage Tasks

Status: Draft for Review
Updated: 2026-05-06

## Checklist

- [x] Create spec, design doc, active plan, and task checklist.
- [ ] Confirm final browser session contract and cookie flags.
- [ ] Confirm CSRF or origin-check policy for refresh and logout.
- [ ] Add frontend tests proving web sessions do not persist token pairs in
  localStorage or sessionStorage.
- [ ] Add frontend tests proving app boot recovers through the browser refresh
  boundary.
- [ ] Add frontend tests proving SSO callback no longer parses token fragments.
- [ ] Add backend tests for refresh cookie attributes.
- [ ] Add backend tests for refresh-cookie use and logout cookie clearing.
- [ ] Add backend tests for CSRF or origin protection on cookie-authenticated
  refresh/logout.
- [ ] Add shared backend helpers for setting and clearing browser session
  cookies.
- [ ] Update login, registration, LDAP, refresh, logout, and SSO callback paths
  in `backend/api/v1/auth.py`.
- [ ] Extract frontend browser session ownership from `frontend/src/lib/api.ts`.
- [ ] Update frontend API and upload helpers to request access tokens through the
  session boundary.
- [ ] Remove token-pair URL-fragment handling from the SSO callback page.
- [ ] Run frontend gates:
  `cd frontend && npm run lint`, `cd frontend && npm test`,
  `cd frontend && npm run build`.
- [ ] Run backend gates:
  `uv run pytest`, `uv run ruff check .`, `uv run mypy backend`.
- [ ] Run documentation gate:
  `python scripts/validate_agents_docs.py --level ERROR`.
- [ ] Update `docs/exec-plans/tech-debt-tracker.md` after implementation status
  changes.
- [ ] Archive this plan and checklist into `docs/exec-plans/completed/`.

## Notes

- Sequence this work with refresh-token hardening so browser refresh cookies are
  backed by server-side session state.
- Do not change API-token management semantics for automation clients.
- Avoid touching `desktop-client/` unless its own tracker explicitly pulls this
  work into that subproject.
