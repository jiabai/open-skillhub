# Pre-Distribution Skill Check - Final Technical Design

Status: final design for implementation handoff
Last updated: 2026-04-26
Scope: `desktop-client/`

> Before the user distributes pending skills to local agent directories, the desktop client performs a read-only check to determine whether a skill with the same name already exists in the target directory, what version is installed, and whether this distribution might cause a downgrade. The check results are used to assist with approval decisions; they are not written to agent directories or to the State DB.

## 1. Problem Statement

In the current distribution flow, after the user clicks `Distribute`, the `distribution-service` installs the downloaded and verified skill package into all configured agent target directories. The existing review list only shows the remote version and the `localRecords` version from the local State DB, without reading the actual state of agent directories.

This creates three problems:

1. **Directory true state is invisible**: If the user manually modified the agent skills directory, the UI approval view cannot see the actually installed version.
2. **Potential downgrades are invisible**: If a skill with the same name in the agent directory has a higher version than the remote pending version, the current distribution would overwrite it with the remote version, but the UI provides no advance warning.
3. **Missing explanation when State DB and filesystem diverge**: `localRecords` is only a snapshot from the desktop client's last successful distribution and does not necessarily equal the current contents of the agent directory.

This design adds a read-only pre-distribution check. It reads metadata for skills with the same name from configured agent target directories and displays the results in the Home/Updates review queue, helping users see the true target state before clicking distribute.

## 2. Non-Goals

- Do not automatically resolve version conflicts.
- Do not perform skill content diff, merge, or rollback.
- Do not change the `DesktopSyncState` persistence schema.
- Do not persist check results to SQLite, JSON config, or agent directories.
- Do not allow the renderer to directly access Node, Electron, or filesystem APIs.
- Do not change the distribution write strategy; users may still proceed with distribution after seeing warnings.

## 3. Current Code Facts

These facts come from the current implementation and must be kept consistent during coding:

- `DesktopSyncState` only persists `localRecords`, `pendingUpdates`, `successfulDistributionCount`, and `lastRefreshedAt`.
- `PendingSyncUpdate.remoteVersion` is a non-null `string`. When the remote version is `null`, `compareRemoteSkills()` does not create a pending update.
- `sync-service.refresh()` is responsible for reading the remote list, comparing `localRecords`, and writing the sync snapshot; it should not read the agent filesystem.
- The renderer can only call the main process through `src/lib/ipc-client.ts` -> `electron/preload.ts` -> `electron/ipc.ts`.
- Agent directory conventions belong to `src/adapters/agents/`; sync and UI should not hardcode path rules for Codex, Claude Code, or Gemini CLI.
- The current "enabled agents" actually equate to supported agents that have resolved `skillsPath` in the runtime config. Agents without configured paths do not participate in distribution and should not show errors in the pre-check.

## 4. Final Architecture Decision

The pre-check is placed in the **main process orchestration + core pre-check service + agent adapter metadata reader** path.

```
Renderer review refresh
  -> desktopClient.refreshSync()
  -> desktopClient.refreshPreDistributionCheck()
  -> render sync state + transient pre-check snapshot

Renderer manual "Refresh Check"
  -> desktopClient.refreshPreDistributionCheck()
  -> render updated transient pre-check snapshot

Main process
  -> reads current pending updates from StateStore
  -> resolves configured agent install contexts from runtime config
  -> calls pre-check service
  -> pre-check service calls adapter.readInstalledSkillMetadata(...)
  -> returns serializable snapshot through IPC
```

Important boundary:

- `sync-service` remains a remote/local snapshot comparison service.
- `distribution-service` remains the only writer to agent directories.
- `pre-distribution-check-service` reads metadata only and has no persistence side effect.
- Renderer stores the returned snapshot in React state only.

## 5. Trigger Rules

| Scenario | Behavior |
| --- | --- |
| App initial load with configured token | Refresh sync state, then run pre-check if `pendingUpdates.length > 0`. |
| User clicks existing queue refresh | Refresh sync state, then run pre-check if there are pending updates. |
| User clicks new `Refresh Check` action | Re-run pre-check against the current persisted pending updates without calling the remote API. |
| Distribution succeeds or partially succeeds | Refresh sync state, then re-run pre-check if pending updates remain. |
| No pending updates | Clear the renderer-held pre-check snapshot and skip filesystem checks. |
| Background polling finds pending updates | It may update tray state as it does today; UI-visible pre-check runs when renderer refreshes review state. |

This preserves the existing polling model while ensuring the visible review surface has fresh check information before the user distributes from that surface.

## 6. Target Agent Set

Pre-check uses the same effective target set as distribution:

1. Refresh the runtime `agentDetection` snapshot.
2. Start from `agentDetection.uniqueTargets`.
3. Build one target job per unique physical `targetPath`, with `coveredAdapters`
   for every assistant represented by that shared target.
4. Use `{ adapter, installContext: { skillsPath: targetPath } }` for the
   primary adapter and fan out one metadata result to every covered assistant.

Rules:

- Missing supported agents are omitted from the target jobs, not marked as errors.
- If no detected/configured target is available, return an empty result plus a global warning. Distribution already fails this case with a clear error.
- If a target `skillsPath` does not contain the skill, treat the covered assistants as `not-installed`; distribution can create the directory later.
- If a target `skillsPath` exists but cannot be read, mark every covered assistant result as `error`.
- Shared paths are read once per pending update and `targetPath`; adapter metadata lookup uses the SKILL `name`, not `remoteSkillId`.

## 7. Adapter Metadata Contract

Add a read-only metadata method to `AgentAdapterV1`:

Type ownership adjustment:

- Move `AgentId` from `src/adapters/agents/base.ts` into `src/types/index.ts`.
- Define `InstalledSkillVersionSource` and `InstalledSkillMetadataV1` in `src/types/index.ts`.
- `src/adapters/agents/base.ts` should import these shared types with `import type`, then expose the method below.

```typescript
export type AgentId = "codex" | "claude-code" | "gemini-cli"

export type InstalledSkillVersionSource =
  | "skill-frontmatter"
  | "manifest-json"
  | "nested-manifest-json"
  | null

export interface InstalledSkillMetadataV1 {
  exists: boolean
  skillDir: string
  version: string | null
  versionSource: InstalledSkillVersionSource
}

export interface ExtractedSkillPayloadV1 {
  skillId: string
  name: string
  version?: string | null
  extractedPath: string
}

export interface AgentAdapterV1 {
  id: AgentId
  displayName: string
  installSkill(payload: ExtractedSkillPayloadV1, context: AgentInstallContextV1): Promise<InstalledSkillV1>
  verifyInstalledSkill(payload: ExtractedSkillPayloadV1, installed: InstalledSkillV1): Promise<boolean>
  readInstalledSkillMetadata(skillName: string, context: AgentInstallContextV1): Promise<InstalledSkillMetadataV1>
}
```

Default filesystem adapter behavior:

1. Normalize and validate `skillName` with the same path-safety rules used by install.
2. Resolve `skillDir = join(context.skillsPath, safeSkillName)`.
3. If `skillDir` does not exist, return `exists: false`, `version: null`.
4. If `skillDir` is not a directory, throw an error.
5. Read version metadata in this priority order:
   - `SKILL.md` frontmatter field `version`
   - root `manifest.json` field `version`
   - `skills/manifest.json` field `version` as a compatibility fallback for current package/test layouts
6. Trim empty strings to `null`.

Malformed metadata files do not fail the check by themselves. The reader should continue to the next source when possible; if no supported source yields a non-empty version, return `version: null`.

The default install path uses `payload.name` as the skill directory key. `payload.skillId` remains the remote/API identity for sync state, package download, and stale-snapshot fingerprints; it must not be used as the local install directory name.

The adapter owns this metadata read because future agent integrations may not use the default filesystem layout.

## 8. Version Parsing And Comparison

Use a small strict parser, not a new dependency.

Supported format:

- `major.minor.patch`
- optional leading `v`
- numeric identifiers only

Unsupported examples return `unknown`:

- `1.0`
- `1.0.0-alpha.1`
- `1.0.0+build.1`
- `latest`
- `2026-04-26`
- empty string

Comparison result enum:

```typescript
export type PreDistributionVersionComparison =
  | "not-installed"
  | "installed-older"
  | "same"
  | "installed-newer"
  | "unknown"
  | "error"
```

Rules:

| Condition | Result | Meaning |
| --- | --- | --- |
| `exists === false` | `not-installed` | New install for this target. |
| metadata read throws | `error` | Check failed for this target. |
| installed or remote version is not strict semver | `unknown` | Show version but do not claim ordering. |
| installed > remote | `installed-newer` | Distribution may downgrade this target. |
| installed < remote | `installed-older` | Normal upgrade. |
| installed === remote | `same` | Idempotent overwrite. |

## 9. Transient Data Contract

Add shared serializable types in `src/types/index.ts`. These are IPC/renderer types only; they are not persisted.

```typescript
export type AgentId = "codex" | "claude-code" | "gemini-cli"

export type InstalledSkillVersionSource =
  | "skill-frontmatter"
  | "manifest-json"
  | "nested-manifest-json"
  | null

export interface InstalledSkillMetadataV1 {
  exists: boolean
  skillDir: string
  version: string | null
  versionSource: InstalledSkillVersionSource
}

export type PreDistributionVersionFormat = "semver" | "unknown"

export type PreDistributionVersionComparison =
  | "not-installed"
  | "installed-older"
  | "same"
  | "installed-newer"
  | "unknown"
  | "error"

export interface AgentPreDistributionCheckResult {
  agentId: AgentId
  displayName: string
  skillDir: string | null
  exists: boolean
  installedVersion: string | null
  installedVersionSource: InstalledSkillVersionSource
  remoteVersion: string
  installedVersionFormat: PreDistributionVersionFormat
  remoteVersionFormat: PreDistributionVersionFormat
  versionComparison: PreDistributionVersionComparison
  checkedAt: string
  durationMs: number
  errorCode: string | null
  errorMessage: string | null
}

export type PreDistributionCheckResults = Record<
  string,
  Partial<Record<AgentId, AgentPreDistributionCheckResult>>
>

export interface PreDistributionCheckSnapshot {
  results: PreDistributionCheckResults
  checkedAt: string
  expiresAt: string
  pendingUpdateFingerprint: string
  targetAgentIds: AgentId[]
  totalDurationMs: number
  globalErrors: string[]
}
```

`pendingUpdateFingerprint` is a stable string built from sorted `remoteSkillId@remoteVersion` pairs. Renderer must discard a snapshot when the current pending update list has a different fingerprint.

## 10. IPC Contract

Keep `sync:refresh` focused on sync state. Add one new IPC channel:

```typescript
desktopClientIpcChannels = {
  // existing
  refreshSync: "sync:refresh",
  distributePendingUpdate: "distribution:run",

  // new
  refreshPreDistributionCheck: "pre-distribution-check:refresh"
}
```

Bridge method:

```typescript
interface DesktopClientBridge {
  refreshSync(): Promise<DesktopSyncState>
  refreshPreDistributionCheck(): Promise<PreDistributionCheckSnapshot>
}
```

The renderer does not pass `pendingUpdates` to the main process. The main handler reads the current `DesktopSyncState` from `StateStore`, then checks exactly those pending updates. This avoids stale or tampered renderer input.

Global handler behavior:

- If `stateStore` is unavailable, throw.
- If there are no pending updates, return an empty snapshot with the current fingerprint.
- If no agent targets are configured, return an empty result with a global warning.
- Per-agent failures stay inside `AgentPreDistributionCheckResult`; they should not fail the whole IPC call unless the handler itself cannot run.

## 11. UI Behavior

The pre-check result must be visible anywhere the user can start distribution.

Required UI changes:

- Pass `PreDistributionCheckSnapshot | null` into `HomeView`, `UpdatesView`, and `PendingUpdatesPanel`.
- Home pending preview shows a compact per-skill target summary before the `Distribute` button.
- Updates full list shows each configured agent result for each pending update.
- Add a `Refresh Check` button to the full pending updates panel.
- Show loading text while the check is running.
- If the snapshot fingerprint does not match current pending updates, show stale/refresh-needed copy and do not display old per-agent claims.
- Distribution remains enabled when pre-check is `unknown` or `error`, but the warning copy must be visible next to the action.

Suggested per-agent labels:

| `versionComparison` | UI tone | Copy intent |
| --- | --- | --- |
| `not-installed` | neutral/success | Not installed on this target. |
| `installed-older` | success | Installed version is older than remote; distribution upgrades it. |
| `same` | neutral | Same version; distribution is an idempotent overwrite. |
| `installed-newer` | warning | Installed version is newer; distribution may downgrade it. |
| `unknown` | warning/neutral | Version ordering cannot be determined. |
| `error` | warning/error | Check failed; distribution is still a user choice. |

`Last checked` for a skill uses the earliest `checkedAt` among that skill's agent results. The snapshot is stale after `expiresAt`.

## 12. Error And Security Rules

Pre-check is informational, but it must not weaken existing fail-closed distribution rules.

- Unsafe skill identifiers still fail validation before any path is joined.
- Renderer never receives privileged filesystem access.
- Pre-check reads only under configured agent `skillsPath` plus the validated skill directory name.
- If a configured path is unreadable, return an `error` result for that agent target.
- If all metadata sources are missing or malformed, return `unknown`; do not throw unless the read itself fails unexpectedly.
- Do not log raw package contents, API tokens, or full file contents.
- Pre-check failure does not block distribution because it is not a security gate; actual package validation, path validation, and install verification still happen in the distribution path.

## 13. Implementation File Map

Create:

| File | Responsibility |
| --- | --- |
| `src/core/pre-distribution-check/version-compare.ts` | Strict semver parser and comparison helpers. |
| `src/core/pre-distribution-check/pre-distribution-check-service.ts` | Iterate pending updates and configured agents, apply timeouts/concurrency, build snapshot. |
| `src/core/pre-distribution-check/pre-distribution-check-config.ts` | Defaults for timeout, concurrency, and snapshot TTL. |
| `src/__tests__/version-compare.test.ts` | Version parser/comparison coverage. |
| `src/__tests__/pre-distribution-check-service.test.ts` | Service behavior, errors, timeout, empty target set. |

Modify:

| File | Change |
| --- | --- |
| `src/types/index.ts` | Move/add `AgentId`, add installed metadata types, and add transient pre-check IPC/renderer types. |
| `src/adapters/agents/base.ts` | Import shared agent types, add `readInstalledSkillMetadata()`, and reuse/export safe skill directory name validation. |
| `src/__tests__/agent-adapters.test.ts` | Cover name-based installation, SKILL.md, root manifest, nested manifest, missing directory, invalid skill directory names. |
| `electron/ipc.ts` | Add `pre-distribution-check:refresh` channel, bridge contract, handler registration. |
| `electron/preload.ts` | Expose `refreshPreDistributionCheck()`. |
| `src/lib/ipc-client.ts` | Add wrapper method and bridge type. |
| `electron/main.ts` | Wire the new handler to `stateStore`, runtime config, and adapters. |
| `src/app/App.tsx` | Manage pre-check snapshot/loading/stale state and refresh after sync/distribution. |
| `src/components/home-view.tsx` | Show compact per-skill pre-check summary before Home distribution actions. |
| `src/components/updates-view.tsx` | Pass pre-check props through. |
| `src/components/pending-updates-panel.tsx` | Show detailed per-agent results and `Refresh Check`. |
| `src/i18n/messages/*` | Add English and Chinese UI copy for check states. |
| `src/__tests__/app.test.tsx` | Cover bridge method, auto check after refresh, stale snapshot handling, refresh button. |

## 14. Performance Rules

Defaults:

| Setting | Value |
| --- | --- |
| Per-target timeout | 5 seconds |
| Total check timeout | 15 seconds |
| Max concurrent target checks | 2 |
| Snapshot TTL | current `pollIntervalMs` |

Concurrency model:

- One global semaphore shared by all `pendingUpdate x agent` checks.
- Preserve completed results when total timeout occurs.
- Mark unfinished checks as `error` with `errorCode = "TIMEOUT"`.

## 15. Test Strategy

Unit tests:

- strict semver parse and compare
- optional `v` prefix
- unsupported prerelease/build/custom/date/tag formats
- `not-installed`, `installed-older`, `same`, `installed-newer`, `unknown`, `error`
- SKILL.md frontmatter parsing priority
- manifest fallback priority
- invalid skill ID path safety

Service tests:

- no pending updates returns empty snapshot
- no configured target agents returns global warning
- missing `skillsPath` directory produces `not-installed`
- unreadable path or adapter throw produces per-agent `error`
- fingerprint changes when pending IDs or versions change
- timeout preserves completed results

Renderer tests:

- initial refresh runs sync then pre-check when pending updates exist
- no pending updates clears snapshot
- Home and Updates surfaces do not show stale claims when fingerprint mismatches
- `Refresh Check` re-runs only pre-check
- distribution refreshes sync state and then pre-checks remaining pending updates

Validation commands:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
```

## 16. Migration And Documentation

No persistence migration is required.

After implementation, update:

- `desktop-client/docs/ARCHITECTURE.md` if the new pre-check service becomes a durable module.
- `desktop-client/docs/references/runtime-and-storage-surface.md` to list the new IPC channel.
- `desktop-client/docs/SECURITY.md` only if new path or symlink behavior is added beyond the rules in this design.

Before coding, create an active ExecPlan under `desktop-client/docs/exec-plans/active/` using this design as the approved technical source.

## 17. Resolved Issues From Earlier Draft

- Moved pre-check out of `sync-service.refresh()` to preserve sync boundaries.
- Removed nullable `remoteVersion` from pending update handling because current `PendingSyncUpdate.remoteVersion` is non-null.
- Replaced ambiguous `older` result for missing installs with explicit `not-installed`.
- Clarified that unconfigured agents are omitted instead of shown as errors.
- Added a safe IPC flow where main reads `StateStore`; renderer does not submit pending updates for filesystem checks.
- Added fingerprint-based stale detection so old results cannot be shown for a changed queue.
- Required Home as well as Updates to show check context because both surfaces can start distribution.

## 18. References

- Core beliefs: `core-beliefs.md`
- Product spec: `../product-specs/2026-04-17-skill-distribution-v1.md`
- Architecture: `../ARCHITECTURE.md`
- Security: `../SECURITY.md`
- Adapter base: `../../src/adapters/agents/base.ts`
- Sync service: `../../src/core/sync/sync-service.ts`
- Distribution service: `../../src/core/distribution/distribution-service.ts`
- IPC contract: `../../electron/ipc.ts`
