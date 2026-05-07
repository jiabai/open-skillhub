# Local Skills Management - Technical Design

Status: proposed, implementation pending
Last updated: 2026-05-02
Scope: `desktop-client/`

## 1. Problem Statement

The desktop client can already detect supported agent skill target directories
and distribute server-approved packages into those targets. It does not yet
inventory the skill packages already present in those directories.

The Local Skills Management feature adds a read-only local inventory plus an
explicit upload action for valid local skills that do not exist on the server.
It must preserve the current privilege model: renderer displays snapshots,
main process owns filesystem and network work, and no agent directory is written
without an explicit distribution approval.

## 2. Non-Goals

- No automatic or bulk upload.
- No editing local skill files.
- No local directory writes.
- No server version append for existing server skills in v1.
- No persisted local inventory database.
- No browser-session JWT Console API calls.

## 3. Current Code Facts

- Agent catalog and shared-target dedupe live in
  `../../src/adapters/agents/definitions.ts` and
  `../../src/core/detection/agent-detection-service.ts`.
- `AgentDetectionSnapshot.uniqueTargets` identifies effective writable skill
  target directories and covered agents, but it does not enumerate child skill
  directories.
- Renderer access flows through
  `../../src/lib/ipc-client.ts` -> `../../electron/preload.ts` ->
  `../../electron/ipc.ts` -> `../../electron/main.ts`.
- Remote skill list normalization currently lives in `../../electron/main.ts`
  through `listRemoteSkills()` and `normalizeSkillSummary()`.
- Download package validation is separate from this feature and remains part of
  the distribution path.
- Backend Client API upload is `POST /api/v1/client/skills/upload`, documented
  in the root product spec `../../../docs/product-specs/2026-05-01-client-skills-upload.md`.

## 4. Architecture Decision

Add a main-process local inventory service and keep upload packaging in the main
process.

```text
agent detection snapshot
  -> local skill inventory service scans unique target directories
  -> Client API list builds server-name lookup
  -> local-skills IPC returns redacted inventory rows
  -> renderer shows inventory and row actions

upload row action
  -> renderer passes local row key
  -> main process revalidates row against current inventory snapshot
  -> main process creates temporary ZIP
  -> main process POSTs Client API upload
  -> temporary ZIP cleanup
  -> refreshed inventory snapshot
```

Boundary rules:

- Agent-specific target ownership remains in the catalog and adapters.
- Inventory scan may read only effective target directories from detection.
- Renderer never receives file contents, ZIP bytes, token values, or arbitrary
  filesystem handles.
- Upload IPC accepts a row key, not a renderer-provided path.
- Server matching uses the resolved safe SKILL identity (`slug` when present,
  otherwise `name`), not remote ID.

## 5. Inventory Model

Add types in `../../src/types/index.ts`:

```typescript
export type LocalSkillValidationState =
  | "valid"
  | "missing-skill-md"
  | "invalid-skill-name"
  | "unreadable"
  | "not-directory"

export type LocalSkillServerState = "existing" | "missing" | "unknown" | "invalid-local"

export interface LocalSkillInventoryRow {
  rowKey: string
  name: string | null
  localVersion: string | null
  packageRootPath: string
  sourceAgents: AgentId[]
  sourceDisplayNames: string[]
  validationState: LocalSkillValidationState
  validationMessage: string | null
  serverState: LocalSkillServerState
  remoteSkillId: string | null
  remoteVersion: string | null
  uploadable: boolean
}

export interface LocalSkillsInventorySnapshot {
  checkedAt: string
  rows: LocalSkillInventoryRow[]
  serverLookupStatus: "ok" | "configuration-missing" | "auth-failed" | "network-error" | "error"
  serverLookupMessage: string | null
}

export interface LocalSkillUploadResult {
  rowKey: string
  uploadedSkillId: string | null
  name: string
  version: string | null
  refreshedSnapshot: LocalSkillsInventorySnapshot
}
```

`rowKey` should be deterministic and opaque to the renderer, for example a
hash of normalized package root path plus the parsed safe SKILL identity when
available.
It is not a persistent ID.

## 6. Local Scan Rules

Create `../../src/core/local-skills/local-skill-inventory-service.ts`.

Responsibilities:

- Accept an `AgentDetectionSnapshot` and filesystem dependencies for tests.
- Iterate `uniqueTargets`, not raw agent statuses, so shared physical targets
  are scanned once.
- For each target path, read direct child entries only.
- Treat each child directory as one candidate package root.
- Read root `SKILL.md` from the candidate.
- Parse frontmatter fields needed by the UI: `name`, `slug`, `version`, and
  `description` if already easy to expose.
- Resolve and validate safe SKILL identity with the same safe-name rules used by
  desktop adapters and backend upload. Prefer `slug` when present, otherwise
  fall back to `name`.
- Return invalid rows with a clear validation state and no upload action.
- Attach every covered agent ID from the unique target to rows found under that
  target.

The service must not recurse across arbitrary compatible read paths in v1.
Compatible read paths are explanatory metadata, not desktop-owned inventory
targets.

## 7. Server Presence Rules

Reuse the main-process Client API list call and normalization rules.

Presence lookup:

1. Fetch `GET /api/v1/client/skills`.
2. Build a `Map<string, RemoteSkillSummary>` keyed by exact server skill name.
3. For each valid local row, set:
   - `existing` when a server skill with the same resolved identity exists
   - `missing` when list succeeds and no same-identity server skill exists
4. For invalid local rows, set `invalid-local`.
5. If server list fails, set valid local rows to `unknown`.

Exact identity matching keeps desktop behavior aligned with backend duplicate
name rules. Case folding must not be introduced in the client unless the backend
contract changes.

## 8. Upload Packaging

Create `../../src/core/local-skills/local-skill-upload-package.ts` or keep this
as a focused helper next to the inventory service.

Packaging rules:

- Revalidate selected package root immediately before creating the ZIP.
- Require root `SKILL.md`.
- Reject empty package roots.
- Reject unsafe relative paths, absolute paths, and path traversal.
- Reject symlinks that resolve outside the package root.
- Enforce conservative file count and total size limits aligned with backend
  upload constraints.
- Create the ZIP under runtime cache or OS temp.
- Return cleanup ownership with the temporary ZIP path.

The packaged ZIP should contain the files at the archive root, so `SKILL.md` is
at the ZIP root.

## 9. Client API Upload

Add a main-process API helper for:

```http
POST /api/v1/client/skills/upload
Content-Type: multipart/form-data
```

Fields:

- `file`: created ZIP package
- `visibility`: `private`

Do not send `skill_uuid` or `metadata` in this v1. Existing server skills are
not uploadable from Local Skills Management.

The helper must use the API token from runtime config and follow the same auth
failure behavior as existing Client API list/download calls.

## 10. IPC And Preload Contract

Add two IPC channels:

```typescript
refreshLocalSkills: "local-skills:refresh"
uploadLocalSkill: "local-skills:upload"
```

Extend bridge interfaces in `../../electron/ipc.ts`,
`../../electron/preload.ts`, and `../../src/lib/ipc-client.ts`:

```typescript
refreshLocalSkills(): Promise<LocalSkillsInventorySnapshot>
uploadLocalSkill(rowKey: string): Promise<LocalSkillUploadResult>
```

IPC validation rules:

- `rowKey` must be a non-empty string under a small length limit.
- Main process must resolve `rowKey` against the latest freshly computed
  inventory, not trust a renderer path.
- Upload should recompute server presence before upload. If the row is no
  longer `missing`, return a conflict-like state and refreshed snapshot.

## 11. Renderer Design

Add a Local Skills route/view using the existing compact desktop shell.

Expected files:

- `../../src/components/local-skills-view.tsx`
- `../../src/app/App.tsx`
- `../../src/components/app-shell.tsx`
- `../../src/i18n/messages/en-US.ts`
- `../../src/i18n/messages/zh-CN.ts`

Renderer state:

- current inventory snapshot
- refresh busy flag
- uploading row key
- row-level last action result

UI rules:

- Do not render Upload for `existing`, `unknown`, or invalid rows.
- Keep row height stable across uploading/error states.
- Use existing activity feedback patterns for success and errors.
- Local path display may be truncated but must remain inspectable through a
  tooltip or secondary detail pattern already used by the app.

## 12. Security Rules

- Renderer receives redacted metadata only.
- Renderer never receives token values, file contents, ZIP bytes, or temp paths.
- Upload IPC accepts row key only.
- Main process revalidates path, SKILL metadata, and package contents before
  upload.
- ZIP cleanup happens on success and failure.
- Logs may include row key, resolved SKILL identity, source agent IDs, and
  normalized error class; logs must not include file contents, token, or archive
  bytes.
- The feature must use `/api/v1/client/skills/upload`; it must not call
  `/api/v1/skills/upload`.

## 13. Error Mapping

Operator-facing classes:

| Class | Examples |
|-------|----------|
| Configuration | missing API base URL or token |
| Auth | invalid token, missing `skill.read`, missing `skill.upload` |
| Network | fetch failure, timeout |
| Local validation | missing `SKILL.md`, invalid name, unreadable directory |
| Packaging | unsafe path, symlink escape, size/count limit |
| Backend validation | invalid ZIP, duplicate name, invalid visibility |
| Conflict | row became existing before upload completed |

Keep backend error `code` when present so support/debugging can correlate
desktop behavior with API logs.

## 14. Implementation File Map

Create:

| File | Responsibility |
|------|----------------|
| `src/core/local-skills/local-skill-inventory-service.ts` | Scan effective target directories and build local rows |
| `src/core/local-skills/local-skill-upload-package.ts` | Create safe temporary ZIP packages and cleanup ownership |
| `src/__tests__/local-skill-inventory-service.test.ts` | Inventory scan, validation, shared target coverage, server matching |
| `src/__tests__/local-skill-upload-package.test.ts` | ZIP layout, SKILL.md requirement, path safety, cleanup |
| `src/components/local-skills-view.tsx` | Local Skills renderer view |

Modify:

| File | Change |
|------|--------|
| `src/types/index.ts` | Add local skills snapshot/upload types |
| `electron/ipc.ts` | Add refresh/upload channels and handlers |
| `electron/preload.ts` | Expose local skills bridge methods |
| `electron/main.ts` | Wire inventory refresh, upload packaging, Client API upload, cleanup |
| `src/lib/ipc-client.ts` | Add typed renderer bridge wrappers |
| `src/app/App.tsx` | Add Local Skills view state and actions |
| `src/components/app-shell.tsx` | Add Local Skills navigation item |
| `src/i18n/messages/en-US.ts` | English copy for view, states, actions |
| `src/i18n/messages/zh-CN.ts` | Chinese copy for view, states, actions |
| `docs/references/runtime-and-storage-surface.md` | After implementation, record new IPC channels and any new temp paths |
| `docs/SECURITY.md` | Keep upload security rules aligned if implementation changes details |

## 15. Test Strategy

Unit tests:

- scans direct child directories under unique agent targets
- reports covered agents for shared physical targets
- rejects missing root `SKILL.md`
- rejects invalid SKILL identities
- marks server presence by exact safe SKILL identity
- hides upload for existing or unknown server state
- creates ZIP with root `SKILL.md`
- rejects path traversal and symlink escape during packaging
- cleans temporary ZIP on success and failure

IPC/main-process tests:

- refresh returns redacted inventory rows
- upload accepts row key and rejects arbitrary path strings
- upload revalidates before packaging
- upload calls `/api/v1/client/skills/upload`
- duplicate-name backend conflict refreshes snapshot

Renderer tests:

- navigation shows Local Skills between Home and Updates
- missing valid rows show Upload
- existing, unknown, and invalid rows do not show Upload
- row busy state disables duplicate upload
- success and error feedback use localized copy

Validation commands:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

## 16. Resolved Spec Issues

- Local rows use resolved SKILL identity and package root identity, not a
  misleading local skill ID.
- Existing detection only finds agent targets; this design adds a separate local
  inventory service for child skill directories.
- Upload endpoint is now concrete: `POST /api/v1/client/skills/upload`.
- V1 upload creates server-missing skills only; version append is explicitly out
  of scope.
- Renderer privilege boundaries and temporary ZIP cleanup are specified.
- Shared physical targets are deduped before scan and represented by covered
  agents.

## 17. References

- Product spec: `../product-specs/2026-05-01-local-skills-management.md`
- Chinese product spec: `../product-specs/2026-05-01-local-skills-management-zh.md`
- Client API contract: `../references/client-api-contract.md`
- Runtime and storage surface: `../references/runtime-and-storage-surface.md`
- Agent detection design: `agent-detection-and-distribution.md`
- Backend upload spec: `../../../docs/product-specs/2026-05-01-client-skills-upload.md`
