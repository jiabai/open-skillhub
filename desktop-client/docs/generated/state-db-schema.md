# State DB Schema

Source of truth: `src/core/storage/state-db.ts`

## File

- `state/state.sqlite3`

## Tables

### `distributed_skills`

Tracks the local sync snapshot for skills known to have been distributed successfully.

| Column | Type | Notes |
|------|------|------|
| `remote_skill_id` | `TEXT` | primary key |
| `name` | `TEXT` | skill display name |
| `installed_version` | `TEXT` | last locally installed version, nullable |
| `remote_version` | `TEXT` | last remote version seen, nullable |
| `last_compared_at` | `TEXT` | ISO timestamp string, nullable |

### `pending_updates`

Tracks reviewable updates derived from comparing remote state against local records.

| Column | Type | Notes |
|------|------|------|
| `remote_skill_id` | `TEXT` | primary key |
| `name` | `TEXT` | skill display name |
| `local_version` | `TEXT` | current local version, nullable |
| `remote_version` | `TEXT` | target remote version |
| `reason` | `TEXT` | `missing-local-record` or `version-mismatch` |

### `sync_metadata`

Stores small key-value sync metadata.

| Column | Type | Notes |
|------|------|------|
| `key` | `TEXT` | primary key |
| `value` | `TEXT` | metadata value |

Current key in use:

- `lastRefreshedAt`

## Not Yet Persisted

The current schema does not persist:

- per-agent distribution run history
- backups metadata
- cached remote catalog snapshots
- detected agent inventory
