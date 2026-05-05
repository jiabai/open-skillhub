# Skills API Boundary

Updated: 2026-05-05
Status: Completed
Purpose: define a stable boundary between Web console JWT APIs and programmatic API token APIs for skill-related endpoints.

## Progress

- [x] (2026-04-24) Narrowed `GET /api/v1/client/skills` to user-owned private-space records and added regression coverage for the `limit=1` connection-check path.
- [x] (2026-05-01) Classified `POST /api/v1/client/skills/upload` as an API-token-only Client API endpoint and linked it to the client skills upload spec, design note, and active implementation plan.
- [x] (2026-05-05) Rechecked the implementation after the client upload merge. Console skill routes now use JWT/RBAC dependencies, and Client API list/download/upload routes use API-token dependencies.
- [x] (2026-05-05) Add explicit route-family auth regression tests so future changes cannot accidentally make Console APIs accept API tokens or Client APIs accept JWT access tokens.
- [x] (2026-05-05) Remove the stale frontend ambiguity where web-console API helpers call `/api/v1/client/skills/download` using browser JWT storage semantics.
- [x] (2026-05-05) Archive this plan after implementation and validation.

## Design Goal

Split skill APIs into two clear layers:

- `Console API`
  - For logged-in human users and the web console
  - Auth model: JWT session via `require_permission(...)`
  - Path family: `/api/v1/skills/...`

- `Client API`
  - For programmatic clients such as CLI, CI, automation, and external integrations
  - Auth model: API token via `require_api_token_permission(...)` or a dedicated API-token dependency
  - Path family: `/api/v1/client/skills/...`

Do not mix JWT-only and API-token-only semantics under the same route family unless there is a strong compatibility reason and the behavior is explicitly documented.

## Endpoint Classification

### Console API

These endpoints belong to the logged-in user console surface and should use JWT-based auth.

- `GET /api/v1/skills`
- `GET /api/v1/skills/public`
- `GET /api/v1/skills/public/{skill_uuid}`
- `GET /api/v1/skills/cache-policy`
- `POST /api/v1/skills`
- `GET /api/v1/skills/{skill_uuid}`
- `PUT /api/v1/skills/{skill_uuid}`
- `DELETE /api/v1/skills/{skill_uuid}`
- `POST /api/v1/skills/{public_uuid}/reference`
- `POST /api/v1/skills/{public_uuid}/clone`
- `PUT /api/v1/skills/{skill_uuid}/pin`
- `PUT /api/v1/skills/{skill_uuid}/unpin`
- `POST /api/v1/skills/upload`
- `POST /api/v1/skills/{skill_uuid}/deactivate`
- `POST /api/v1/skills/{skill_uuid}/activate`
- `GET /api/v1/skills/{skill_uuid}/versions`
- `GET /api/v1/skills/{skill_uuid}/versions/diff`
- `GET /api/v1/skills/{skill_uuid}/versions/{version}`
- `GET /api/v1/skills/{skill_uuid}/versions/{version}/install-instructions`
- `POST /api/v1/skills/{skill_uuid}/versions/{version}/rollback`
- `GET /api/v1/skills/{skill_uuid}/files`
- `GET /api/v1/skills/{skill_uuid}/files/{file_path}`

### Client API

These endpoints belong to the programmatic integration surface and should use API-token auth.

- `GET /api/v1/client/skills`
  - Returns the API token owner's own private-space skill inventory
  - Includes reference and clone records because they are owned by the user
  - Excludes unowned public catalog rows that were never imported into the user's space
- `POST /api/v1/client/skills/download`
- `POST /api/v1/client/skills/upload`
  - Accepts complete ZIP-packaged skills from API-token callers
  - Creates a user-owned skill when `skill_uuid` is absent
  - Appends a new version to a user-owned non-reference skill when `skill_uuid` is supplied

Future client-oriented endpoints should also live under `/api/v1/client/skills/...`, for example:

- `POST /api/v1/client/skills/resolve`
- `GET /api/v1/client/skills/{skill_uuid}/manifest`
- `GET /api/v1/client/skills/{skill_uuid}/package`
- `POST /api/v1/client/skills/sync`

## Current Inconsistencies

No backend route-level mismatch remains after the 2026-05-05 recheck.

The current cleanup item is in the frontend API client: `downloadSkill()` and
`downloadSkillRaw()` live in the web-console API module but call
`POST /api/v1/client/skills/download`, which is intentionally API-token-only.
Because those helpers use the same browser JWT storage and refresh machinery as
Console API calls, a future UI caller would get a confusing 401 and could blur
the route-family boundary again.

The intended fix is to make the helper names and parameters explicit:
`downloadClientSkill()` and `downloadClientSkillRaw()` must require an API token
argument and must not use browser JWT refresh behavior. If the web console later
needs human-initiated downloads, that should be designed as a separate Console
API flow instead of reusing the Client API path implicitly.

## Auth Rules

### Console API

- Use `require_permission(...)`
- Accept normal logged-in JWT access tokens
- Return models suited for the web console and interactive users

### Client API

- Use `require_api_token_permission(...)` or a dedicated API-token dependency
- Accept API tokens only
- Return stable, integration-oriented models
- Avoid exposing UI-only or internal presentation fields

## Permission Principles

- `skill.list` and `skill.read`
  - Required for console browsing and detail views
  - May be reused by client APIs only where programmatic read access is explicitly intended for the caller's own workspace inventory

- `skill.create`, `skill.update`, `skill.delete`, `skill.upload`
  - Console-first capabilities
  - Only expose through client APIs after a concrete automation use case is defined
  - `skill.upload` is intentionally exposed through `POST /api/v1/client/skills/upload` for desktop-client and automation ZIP upload workflows

- `skill.download`
  - High-sensitivity export/distribution capability
  - Keep in the Client API surface by default
  - Browser-console code may wrap this route only when the caller explicitly
    supplies an API token and the helper name makes the Client API boundary clear

## Linked Upload Contract

The client upload endpoint is documented separately because it has its own ZIP
upload, versioning, and audit requirements:

- Product spec: `docs/product-specs/2026-05-01-client-skills-upload.md`
- Design note: `docs/design-docs/client-skills-upload-api.md`
- ExecPlan: `docs/exec-plans/completed/client-skills-upload-plan.md`
- Task checklist: `docs/exec-plans/completed/client-skills-upload-tasks.md`

## Migration Order

1. Align existing console-used skill read endpoints with JWT auth. Done.
2. Introduce `/api/v1/client/skills/...` routes for token-based distribution workflows. Done.
3. Keep skill download under `/api/v1/client/skills/download` for API-token callers.
4. Update tests to reflect the final route split. Done.
5. Add documentation for callers so JWT and API token usage are not confused. Done.

## Decision Log

- Decision: Keep client skill upload under `/api/v1/client/skills/upload` instead of widening `/api/v1/skills/upload` to accept API tokens.
  Rationale: the route family should communicate the auth model. Mixing JWT Session and API Token upload semantics under the same path would make permissions, audit source, and caller expectations harder to reason about.
  Date/Author: 2026-05-01 / Codex

- Decision: Do not add a JWT Console API download route in this batch.
  Rationale: existing desktop and automation downloads already use the API-token
  Client API contract. A human console download flow has separate product and
  permission questions and should not be inferred from stale frontend helpers.
  Date/Author: 2026-05-05 / Codex

## Validation Notes

- 2026-05-01: Documentation-only boundary update. `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors and 0 warnings.
- 2026-05-05: Frontend red/green check: `npm test -- api-download.test.ts` first failed because `downloadClientSkill*` helpers did not exist, then passed after adding explicit API-token Client API helpers.
- 2026-05-05: Backend focused boundary check: `uv run pytest tests/test_skills_api_boundary.py -v` passed with 2 tests.
- 2026-05-05: Full backend check: `uv run pytest` passed with 642 tests.
- 2026-05-05: Static/backend docs checks passed: `uv run ruff check .`, `uv run mypy backend`, and `python scripts/validate_agents_docs.py --level ERROR`.
- 2026-05-05: Full frontend checks passed: `npm run lint`, `npm test` with 64 tests, and `npm run build`.
