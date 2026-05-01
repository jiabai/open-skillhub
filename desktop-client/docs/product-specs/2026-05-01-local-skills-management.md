# Local Skills Management

Status: canonical local product spec, implementation pending

## Purpose

Build a review-first Local Skills view for the desktop client. Operators must be
able to see valid skills found in local agent skill directories, understand
whether each skill already exists on the server, and explicitly upload a
server-missing local skill through the Client API.

This feature is an inventory and upload surface. It does not change the
existing remote-update review and distribution workflow.

## Goals

- Add a dedicated Local Skills view to the primary navigation, positioned
  between Home and Updates.
- Enumerate local skill package roots from installed or explicitly configured
  agent skill targets using the existing agent catalog and detection snapshot.
- Show the local skill name, local version when available, source agents,
  package root path, validation state, and server presence state.
- Compare local skills against `GET /api/v1/client/skills` by SKILL name, not by
  local directory path or remote skill ID.
- Show an Upload action only for valid local skills whose SKILL name is missing
  from the server response.
- Upload server-missing skills by packaging the local skill directory as a ZIP
  and sending it to `POST /api/v1/client/skills/upload` with API-token
  authentication.
- Keep all filesystem reads, ZIP creation, API token usage, and network upload
  work in the Electron main process.
- Refresh the Local Skills list after a successful upload so the row moves from
  missing to existing server state.

## Non-Goals

- No automatic upload, background upload, or bulk upload.
- No in-app editing of local skill files.
- No deletion of local or server skills.
- No server-side version management from this view for skills that already
  exist on the server. Appending a new version to an existing server skill is a
  future workflow.
- No writes to agent skill directories. Local discovery is read-only.
- No persisted local skill inventory in SQLite or config JSON.
- No changes to API token bootstrap, RBAC, or backend upload semantics.
- No use of browser-session JWT Console API routes.

## Supported Agents

The feature uses the existing catalog-backed agent detection surface. Supported
agent IDs and display names are defined in
`../references/runtime-and-storage-surface.md` and
`../../src/adapters/agents/definitions.ts`.

The first implementation must cover all current catalog IDs:
`claude-code`, `cursor`, `windsurf`, `copilot`, `roocode`, `cline`,
`gemini-cli`, `codex`, `opencode`, `kilocode`, `amp`, `kiro`, `warp`, `trae`,
`factory`, `kimi`, `mistral`, `pi`, `antigravity`, and `openclaw`.

## Core Product Rules

- Server state remains authoritative for server visibility and remote versions.
- Local inventory is a read-only snapshot until an operator clicks Upload.
- A local skill has no remote skill ID unless a server skill with the same SKILL
  name exists.
- Local directory names are not remote identity. The canonical comparison key is
  the validated SKILL name from the root `SKILL.md`.
- Existing server skills do not show upload controls in this v1, even if the
  local version differs.
- Duplicate local copies are allowed in the inventory. Rows represent unique
  local package roots and show every covered source agent for shared physical
  targets.
- Shared physical agent targets are deduped by normalized path before scanning,
  matching the existing detection and distribution rules.
- Upload must fail closed when the package root is invalid, `SKILL.md` is
  missing, the SKILL name is unsafe, the directory cannot be read, or the API
  token lacks upload permission.

## Local Skill Identity And Matching

### Local Package Root

A local package root is a direct child directory of an effective agent skill
target. The root is considered valid only when it contains a root-level
`SKILL.md` file.

The inventory may display invalid child directories, but invalid entries must
be clearly marked and must not expose Upload.

### Local Skill Name

The SKILL name is read from root `SKILL.md` frontmatter. It must pass the same
safe-name expectations used by desktop filesystem operations and backend upload
validation:

- non-empty after trimming
- no `/` or `\`
- not `.` or `..`
- no path traversal segment
- no leading dot
- within the backend skill-name length limit

If `SKILL.md` lacks a usable name, the row is invalid and not uploadable.

### Server Presence

The main process fetches `GET /api/v1/client/skills` and builds a lookup by
server skill `name`.

Server presence states:

| State | Meaning | Upload |
|-------|---------|--------|
| `existing` | A server skill has the same SKILL name | Hidden |
| `missing` | No server skill has the same SKILL name | Visible when local package is valid |
| `unknown` | Server list failed or auth/config is unavailable | Hidden |
| `invalid-local` | Local root cannot be uploaded safely | Hidden |

When a local row is `existing`, display the remote skill ID and latest remote
version as secondary metadata. Do not use remote skill ID as the local row key.

## Upload Behavior

Upload is available only for a valid local package root with server presence
`missing`.

Upload flow:

```text
operator clicks Upload
  -> renderer invokes typed IPC with local row key
  -> main process revalidates the selected local package root
  -> main process creates a ZIP with root SKILL.md and package contents
  -> main process POSTs multipart/form-data to /api/v1/client/skills/upload
  -> main process removes temporary upload artifacts
  -> renderer refreshes local inventory and server presence
```

Request rules:

- Endpoint: `POST /api/v1/client/skills/upload`
- Auth: API Token bearer token from the existing secret-store/runtime config
- Content type: `multipart/form-data`
- Fields:
  - `file`: ZIP package
  - `visibility`: `private`
- Do not send `skill_uuid` in v1, because this view creates only
  server-missing skills.
- Do not send `metadata` in create mode. The backend creates the skill from the
  ZIP root `SKILL.md`.

The main process must delete temporary ZIP files after success or failure.

## UI Specification

### Navigation

Add a Local Skills navigation item between Home and Updates. The first screen is
the usable inventory table, not an explanatory landing page.

### Local Skills View

The view contains a compact inventory table or list using existing desktop UI
patterns:

- Skill name
- Local version, when available from `SKILL.md` frontmatter or supported
  metadata readers
- Source agents, using catalog display names
- Local package root path, truncated but inspectable
- Server status
- Remote version and remote ID when server status is existing
- Row action

### Actions And States

- `Refresh`: rerun local inventory scan and server presence lookup.
- `Upload`: visible only for valid, server-missing rows.
- `Uploading`: disable the row action and prevent duplicate uploads.
- `Uploaded`: show success feedback, then refresh inventory.
- `Invalid local skill`: show the validation reason and no upload control.
- `Server unavailable` or `token missing`: show unknown server state and no
  upload controls.
- `Name conflict after click`: if another upload or server change creates the
  skill before this upload completes, surface the backend conflict and refresh.

## Architecture Boundaries

- Renderer UI displays snapshots and invokes typed IPC only.
- Preload exposes only local-skills inventory refresh and upload methods; it
  never exposes filesystem or token primitives.
- Electron main process owns:
  - reading agent detection snapshots
  - scanning skill target directories
  - reading root `SKILL.md`
  - validating local package roots
  - creating and deleting temporary ZIPs
  - calling Client API list and upload routes
- Inventory snapshots are transient renderer state. They are not written to
  `state.sqlite3`, `state.json`, config JSON, or agent directories.
- The existing sync state remains remote-distribution state and must not be
  reused as the local inventory store.

## Security Requirements

- The renderer must not receive raw API tokens, local file contents, ZIP bytes,
  or temporary upload paths.
- IPC upload input must be a stable local row key from the latest main-process
  snapshot, not an arbitrary renderer-provided filesystem path.
- Main process must revalidate the selected package root immediately before ZIP
  creation.
- ZIP creation must reject path traversal, unsafe names, symlinks that escape
  the package root, missing root `SKILL.md`, unreadable files, and size/count
  limits that would exceed backend upload constraints.
- Upload uses only Client API routes and API-token auth.
- Temporary upload artifacts are created under runtime cache or OS temp
  directories and cleaned after success or failure.

## Acceptance Criteria

- Local Skills appears between Home and Updates.
- The view lists local skill package roots from all detected/configured agent
  targets and groups shared physical targets by covered agents.
- Valid local skills show server presence by SKILL name.
- Existing server skills do not show Upload.
- Missing valid local skills show Upload.
- Invalid local entries explain why Upload is unavailable.
- Clicking Upload for a missing local skill creates a server skill through
  `POST /api/v1/client/skills/upload`, then refreshes the row to existing state.
- Missing token, invalid token, missing `skill.upload` permission, network
  failure, invalid ZIP, duplicate name, and backend validation errors surface as
  distinct operator-facing states.
- No local skill files are modified during scan or upload.
- No raw token, file contents, or upload ZIP bytes are exposed to renderer state
  or logs.

## References

- API contract: `../references/client-api-contract.md`
- Runtime and storage surface: `../references/runtime-and-storage-surface.md`
- Agent detection: `../design-docs/agent-detection-and-distribution.md`
- Technical design: `../design-docs/local-skills-management.md`
