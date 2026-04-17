# Client API Contract

## Routes Used By The Desktop Client

- `GET /api/v1/client/skills`
- `POST /api/v1/client/skills/download`

## Auth Model

- Bearer token auth
- Current desktop runtime bootstrap reads `OPEN_SKILLHUB_API_TOKEN` from the environment when Electron is launched manually

## `GET /api/v1/client/skills`

Response model from `backend/schemas/client_skill.py`:

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

Desktop normalization rules in `electron/main.ts`:

- Accept `id`, `skill_uuid`, `skillUuid`, or `remoteSkillId` as the remote identifier
- Accept `version`, `current_version`, `currentVersion`, or `latest_version.version` as the remote version
- Accept `updatedAt`, `updated_at`, or `latest_version.updated_at` as the update timestamp

## `POST /api/v1/client/skills/download`

Request model from `backend/schemas/skill_download.py`:

```json
{
  "skill_uuid": "uuid",
  "version": "1.2.0"
}
```

Response model from `backend/schemas/skill_download.py`:

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

Desktop handling rules:

- `encrypted_code` is base64-decoded into the downloaded artifact
- `checksum` is verified before extraction
- `expires_at` is enforced before extraction
- if `encryption_enabled` is `true` and no decryptor dependency exists, package preparation fails closed

## Verification Path

- `uv run pytest tests/test_client_skills_api.py -q`
