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
| `installed_content_hash` | `TEXT` | SHA-256 content hash of last installed version, nullable |
| `remote_content_hash` | `TEXT` | SHA-256 content hash of last remote version, nullable |
| `last_compared_at` | `TEXT` | ISO timestamp string, nullable |

### `pending_updates`

Tracks reviewable updates derived from comparing remote state against local records.

| Column | Type | Notes |
|------|------|------|
| `remote_skill_id` | `TEXT` | primary key |
| `name` | `TEXT` | skill display name |
| `local_version` | `TEXT` | current local version, nullable |
| `remote_version` | `TEXT` | target remote version |
| `local_content_hash` | `TEXT` | content hash of current local version, nullable |
| `remote_content_hash` | `TEXT` | content hash of target remote version, nullable |
| `reason` | `TEXT` | `missing-local-record` or `version-mismatch` |

### `sync_metadata`

Stores small key-value sync metadata.

| Column | Type | Notes |
|------|------|------|
| `key` | `TEXT` | primary key |
| `value` | `TEXT` | metadata value |

Current keys in use:

- `lastRefreshedAt`
- `successfulDistributionCount`

## Not Persisted (documented v1 non-goals)

The following are deliberately NOT persisted in v1 (see the skill-distribution-v1 spec
and the tech-debt tracker DC-003):

- per-agent distribution run history — the Activity panel is session-scoped and resets on restart
- backups / rollback metadata
- cached remote catalog snapshots
- detected agent inventory
