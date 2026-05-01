# Client API Contract

> **Last Updated**: 2026-05-02
> **Version**: v1
> **Owner**: Desktop Client Team

## Overview

This document defines the backend API routes, request/response shapes, and normalization rules used by the Open SkillHub desktop client. These are client-oriented endpoints that use bearer token authentication, separate from the browser-session JWT console routes.

## Routes Used By The Desktop Client

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/v1/client/skills` | List available skills with version metadata |
| `POST` | `/api/v1/client/skills/download` | Download a specific skill version |
| `POST` | `/api/v1/client/skills/upload` | Upload a ZIP-packaged skill through API-token auth |

## Auth Model

- **Type**: Bearer token authentication
- **Bootstrap Path**: Desktop runtime prefers the keytar-backed secret store.
  `OPEN_SKILLHUB_API_TOKEN` remains a first-run seed and current-session
  fallback when secret storage is unavailable.
- **Security Rule**: The token must never be written to plaintext config, renderer state, or logs (see `docs/SECURITY.md`)

## Configuration Probe

The API token configuration UI should test connection state through a
client-oriented authenticated route:

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/v1/client/skills?limit=1` | Verify that the configured base URL is reachable and the bearer token is accepted |

This is the only token validation probe in the desktop client contract. Do not
add `/api/v1/health` for this workflow; root `/health` remains an operational
health check and does not prove that the bearer token is valid.

## `GET /api/v1/client/skills`

### Purpose

Returns a list of skills available for sync, including version metadata and downloadability status.

### Response Model

Source: `backend/schemas/client_skill.py`

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "excel",
      "is_downloadable": true,
      "latest_version": {
        "version": "1.2.0",
        "updated_at": "2026-04-17T12:00:00Z"
      }
    }
  ],
  "total": 1
}
```

### Desktop Normalization Rules

Source: `electron/main.ts`

The desktop client accepts multiple field name variants from the backend to maintain compatibility during API evolution:

| Purpose | Accepted Field Names |
|---------|---------------------|
| Remote identifier | `id`, `skill_uuid`, `skillUuid`, `remoteSkillId` |
| Remote version | `version`, `current_version`, `currentVersion`, `latest_version.version` |
| Update timestamp | `updatedAt`, `updated_at`, `latest_version.updated_at` |

**Rationale**: These normalization rules allow the desktop client to handle backend API changes without requiring immediate client updates. The rules are implemented in the Electron main process during response parsing.

## `POST /api/v1/client/skills/download`

### Purpose

Downloads a specific version of a skill package for installation or distribution.

### Request Model

Source: `backend/schemas/skill_download.py`

```json
{
  "skill_uuid": "uuid",
  "version": "1.2.0"
}
```

### Response Model

Source: `backend/schemas/skill_download.py`

```json
{
  "skill_uuid": "uuid",
  "version": "1.2.0",
  "encrypted_code": "base64-encoded payload",
  "checksum": "sha256:...",
  "expires_at": "2026-04-17T12:00:00Z",
  "cache_ttl_seconds": 300,
  "archive_size_bytes": 12345,
  "encryption_enabled": false,
  "download_filename": "excel-1.2.0.zip",
  "decryption_hint": null
}
```

### Desktop Handling Rules

The desktop client must enforce the following validation sequence before extracting or installing packages:

1. **Base64 Decode**: `encrypted_code` is base64-decoded into the downloaded artifact
2. **Checksum Verification**: `checksum` is verified against the decoded payload before extraction
3. **Expiration Enforcement**: `expires_at` is enforced before extraction; expired packages are rejected
4. **Encryption Handling**: If `encryption_enabled` is `true`, the Electron main
   process decrypts the payload with `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET`,
   which must match the backend `SECRET_KEY` used for download encryption.
   Missing or invalid decryption material fails closed before extraction or
   agent-directory writes.

## `POST /api/v1/client/skills/upload`

### Purpose

Uploads a ZIP-packaged skill through the Client API. The desktop Local Skills
Management v1 uses this route only to create server-missing skills from valid
local package roots.

### Request Model

Source: `backend/api/v1/client_skills.py`

Content type: `multipart/form-data`

| Field | Type | Required | Desktop V1 Usage |
|-------|------|----------|------------------|
| `file` | `UploadFile` | Yes | ZIP package created by the Electron main process |
| `skill_uuid` | `str` | No | Not sent by Local Skills Management v1 |
| `visibility` | `str` | No | Sent as `private` for Local Skills Management v1 |
| `metadata` | `str` | No | Not sent in create mode |

### Response Models

Create new skill:

```json
{
  "id": "uuid",
  "name": "my-skill",
  "description": "A useful skill",
  "version": "1.0.0",
  "current_version": "1.0.0",
  "dependencies": []
}
```

Append existing skill version:

```json
{
  "version": "1.2.0",
  "current_version": "1.2.0",
  "dependencies": []
}
```

### Desktop Handling Rules

- Use API Token bearer auth with `skill.upload` permission.
- Do not call the browser-session `POST /api/v1/skills/upload` route from the
  desktop runtime.
- Local Skills Management v1 creates missing server skills only, so it sends no
  `skill_uuid` and no `metadata`.
- Main process must create the ZIP, call the route, and clean temporary upload
  artifacts after success or failure.
- Renderer must receive only redacted upload results and refreshed inventory
  state.
- Keep backend error `code` values when present so operator-facing messages can
  distinguish auth, duplicate-name, invalid ZIP, and validation failures.

## Related Documentation

- **Security Rules**: `docs/SECURITY.md` - Secret handling, privilege boundaries, package validation
- **Runtime Surface**: `runtime-and-storage-surface.md` - Environment variables, IPC channels, app paths
- **Design Rules**: `docs/DESIGN.md` - IPC and contract rules, backend-facing contract ownership

## Verification

```bash
uv run pytest tests/test_client_skills_api.py -q
```

## Change History

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-05-02 | v1 | Documented Client API ZIP upload route for desktop Local Skills planning | Codex |
| 2026-04-23 | v1 | Documented secret-store bootstrap and authenticated configuration probe | Codex |
| 2026-04-23 | v1 | Initial contract documentation with normalization rules and handling rules | Desktop Client Team |
