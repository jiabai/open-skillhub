# Skills API Boundary

Updated: 2026-04-24
Status: Draft
Purpose: define a stable boundary between Web console JWT APIs and programmatic API token APIs for skill-related endpoints.

## Progress

- [x] (2026-04-24) Narrowed `GET /api/v1/client/skills` to user-owned private-space records and added regression coverage for the `limit=1` connection-check path.

## Design Goal

Split skill APIs into two clear layers:

- `Console API`
  - For logged-in human users and the web console
  - Auth model: JWT session via `require_permission(...)`
  - Path family: `/api/v1/skills/...`

- `Client API`
  - For programmatic clients such as CLI, CI, automation, MCP, and external integrations
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

Future client-oriented endpoints should also live under `/api/v1/client/skills/...`, for example:

- `POST /api/v1/client/skills/resolve`
- `GET /api/v1/client/skills/{skill_uuid}/manifest`
- `GET /api/v1/client/skills/{skill_uuid}/package`
- `POST /api/v1/client/skills/sync`

## Current Inconsistencies

The following existing endpoints are currently implemented as API-token-only but conceptually belong to the Console API because they are used by the web UI:

- `GET /api/v1/skills`
- `GET /api/v1/skills/{skill_uuid}`
- `GET /api/v1/skills/{skill_uuid}/versions`
- `GET /api/v1/skills/{skill_uuid}/versions/{version}`
- `GET /api/v1/skills/{skill_uuid}/versions/{version}/install-instructions`

The following client endpoint is already implemented, but its list semantics need to stay tightly scoped to owned workspace records rather than the broader visible-skill catalog:

- `GET /api/v1/client/skills`

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

- `skill.download`
  - High-sensitivity export/distribution capability
  - Keep in the Client API surface by default

## Migration Order

1. Align existing console-used skill read endpoints with JWT auth.
2. Introduce `/api/v1/client/skills/...` routes for token-based distribution workflows.
3. Remove legacy `/api/v1/skills/download` and keep only `/api/v1/client/skills/download`.
4. Update tests to reflect the final route split.
5. Add documentation for callers so JWT and API token usage are not confused.
