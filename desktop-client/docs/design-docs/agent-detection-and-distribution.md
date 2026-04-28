# Agent Detection And Targeted Distribution - Technical Design

Status: design for implementation handoff
Last updated: 2026-04-27
Scope: `desktop-client/`

> This document describes the target design for expanding the desktop client from 3 configured agent targets to 20 detected AI coding assistants. It is not implemented yet. The implementation must keep current renderer privilege boundaries and review-before-write behavior.

## 1. Problem Statement

The current desktop client resolves only three agent skill paths: Codex, Claude Code, and Gemini CLI. It treats "enabled agents" as the adapters that have a configured `skillsPath`, then writes an approved package to each target.

The new product spec requires the client to:

1. Detect which supported AI coding assistants are installed on the local machine.
2. Distribute only to installed or explicitly configured assistant targets.
3. Expand `AgentId` and adapter registration from 3 to 20 supported SKILL-capable assistants.
4. Avoid duplicate writes when multiple assistants share the same physical skill directory.
5. Hide the distribution action when every effective target already has the same skill version, while still allowing the local `StateStore` to be reconciled.

## 2. Non-Goals

- Do not auto-install missing AI assistants.
- Do not detect assistant executable versions or running processes.
- Do not add a renderer-side filesystem API.
- Do not write compatible read paths that are not owned distribution targets.
- Do not add a manual path customization UI beyond environment variables.
- Do not integrate unsupported assistants: Zed, AugmentCode, JetBrains AI.
- Do not change backend API contracts.

## 3. Current Code Facts

These facts come from the current implementation and must stay true unless the active ExecPlan explicitly changes them:

- `AgentId` is currently `"codex" | "claude-code" | "gemini-cli"` in `../../src/types/index.ts`.
- `../../src/adapters/agents/registry.ts` registers three filesystem adapters.
- `../../src/core/runtime/runtime-config-manager.ts` owns default root detection and environment variable path overrides.
- `DesktopRuntimeConfig.agentSkillsPaths` is `Partial<Record<AgentId, string>>`, which cannot represent shared physical targets or multiple targets per agent.
- `../../electron/main.ts` derives distribution targets through `getEnabledAgentIds()` and pre-check targets through `getPreDistributionCheckTargets()`.
- `../../src/core/pre-distribution-check/pre-distribution-check-service.ts` reads installed metadata but does not persist its snapshot.
- `../../src/core/distribution/distribution-service.ts` validates one package, writes each requested agent target, and updates local state only when all requested target writes succeed.
- Renderer access flows only through `../../src/lib/ipc-client.ts` -> `../../electron/preload.ts` -> `../../electron/ipc.ts` -> `../../electron/main.ts`.

## 4. Architecture Decision

Introduce an adapter-owned agent catalog plus a main-process detection service.

```
Agent catalog
  -> runtime config manager
  -> agent detection service
  -> main process IPC handlers
  -> renderer detection state

Distribution approval
  -> main process refreshes detection snapshot
  -> pre-distribution check reads effective targets
  -> distribution service writes unique physical targets only
  -> StateStore updates only after successful write coverage or explicit reconcile
```

Boundary rules:

- Agent-specific path rules live in `src/adapters/agents/`.
- Detection orchestration and path dedupe live in `src/core/detection/`.
- Distribution remains the only code path that writes agent directories.
- Renderer only displays snapshots and invokes typed IPC actions.
- Sync still compares remote server state against local records; it does not scan agent directories.

## 5. Agent Catalog

Create a data-driven catalog in `../../src/adapters/agents/definitions.ts`.

```typescript
export interface AgentPathDefinition {
  id: AgentId
  displayName: string
  detectionDirs: string[]
  defaultTargets: Array<{
    path: string
    role: "primary" | "owned-secondary"
    sharedPathKey?: string
  }>
  compatibleReadPaths?: string[]
  pathResolution: "all-owned" | "priority"
  envVar: string
}
```

Rules:

- `detectionDirs` decide automatic installation status.
- `defaultTargets` are the only default paths the desktop client may write.
- `compatibleReadPaths` document assistant read behavior but are not write targets.
- Environment variables replace `defaultTargets` with exactly one explicit target for that assistant.
- `pathResolution: "priority"` is used by OpenClaw; the first existing default target wins. If an env var is set, the env target wins.
- `pathResolution: "all-owned"` writes all owned targets after dedupe.

## 6. Canonical Agent IDs

The expanded `AgentId` union must use these exact values:

```typescript
export type AgentId =
  | "claude-code"
  | "cursor"
  | "windsurf"
  | "copilot"
  | "roocode"
  | "cline"
  | "gemini-cli"
  | "codex"
  | "opencode"
  | "kilocode"
  | "amp"
  | "kiro"
  | "warp"
  | "trae"
  | "factory"
  | "kimi"
  | "mistral"
  | "pi"
  | "antigravity"
  | "openclaw"
```

Adapters can continue to reuse `createFilesystemAgentAdapter()` unless a future assistant needs a non-standard package layout.

## 7. Detection Service

Create `../../src/core/detection/agent-detection-service.ts`.

Input dependencies:

- agent definitions
- environment variables
- platform home directory resolver
- filesystem `stat`/`access` helpers
- clock

Output snapshot:

```typescript
export type AgentInstallSource = "auto-detected" | "environment" | "missing"

export interface AgentInstallStatus {
  agentId: AgentId
  displayName: string
  installed: boolean
  source: AgentInstallSource
  detectionDirs: string[]
  targetPaths: string[]
  compatibleReadPaths: string[]
  reason: string | null
}

export interface AgentSkillTarget {
  targetId: string
  targetPath: string
  primaryAgentId: AgentId
  coveredAgentIds: AgentId[]
  sharedPathKey: string | null
  source: AgentInstallSource
}

export interface AgentDetectionSnapshot {
  checkedAt: string
  supportedAgentCount: number
  installedAgentIds: AgentId[]
  agentStatuses: AgentInstallStatus[]
  uniqueTargets: AgentSkillTarget[]
}
```

Detection rules:

- Automatic detection: installed when at least one detection directory exists.
- Environment override: installed/configured when the env var has a non-empty path.
- Missing agents have no write target.
- OpenClaw selects the first existing default target. If no default target exists and no env var is set, it is missing.
- Shared physical targets are deduped by normalized path. On Windows, the dedupe key must be case-insensitive.
- `targetId` should be stable, for example `sha256(normalizedTargetPath)` or another deterministic path-safe value.

## 8. Runtime Config Changes

Replace direct path resolution in `runtime-config-manager.ts` with catalog-driven detection.

Target shape:

```typescript
export interface DesktopRuntimeConfig {
  apiBaseUrl: string
  locale: AppLocale
  apiToken: string | null
  pollIntervalMs: number
  cacheDirectory: string
  agentDetection: AgentDetectionSnapshot
}
```

Compatibility:

- Remove `agentSkillsPaths` only when all call sites are migrated in the same task.
- If a staged migration keeps `agentSkillsPaths` temporarily, it must be derived from `agentDetection.uniqueTargets` and marked as transitional in the active ExecPlan.

Reload rules:

- App startup builds an initial detection snapshot.
- Manual "rediscover agents" IPC reloads only detection state.
- Saving API configuration may reload runtime config, but agent detection must not depend on API token state.
- Distribution must refresh detection again immediately before building write targets.

## 9. Pre-Distribution Check Integration

The current pre-check service can be extended instead of replaced.

Required changes:

- Accept `AgentSkillTarget[]` rather than one `skillsPath` per `AgentId`.
- Cache metadata reads by `remoteSkillId + targetPath` so shared paths are checked once.
- Fan out one physical result to every `coveredAgentId`.
- Keep fingerprint and TTL behavior from the existing pre-check design.
- Continue storing snapshots only in renderer React state.

Comparison-to-action mapping:

| Target comparison | Write action |
| --- | --- |
| not installed | write |
| installed older | write |
| installed newer | write, with downgrade warning |
| unknown | write, with unknown-version warning |
| error | allow user decision, but write path validation can still fail closed |
| same | skip write |

If every effective target is `same`, renderer must hide the distribution button and show a local-record reconcile action.

## 10. Distribution Service Changes

`SkillDistributionRequest.enabledAgentIds` is not expressive enough for shared paths. Replace it with effective targets:

```typescript
export interface SkillDistributionRequest {
  skillId: string
  name: string
  version: string | null
  packageSource: unknown
  targets: AgentSkillTarget[]
}

export type SkillDistributionTargetStatus =
  | "success"
  | "covered-by-shared-path"
  | "skipped-agent-not-installed"
  | "skipped-same-version"
  | "failed"
```

Rules:

- Validate and extract the package once.
- Write each unique physical target at most once.
- Mark shared covered assistants as `covered-by-shared-path`.
- Skip same-version targets without writing.
- Update `StateStore` only when every installed/effective assistant is successful, covered, or skipped as same-version.
- If any write fails, keep the pending update and report partial status.
- Cleanup package artifacts in `finally`, preserving the ownership contract from the package cleanup work.

## 11. Local Record Reconcile

Add a non-directory-writing action for stale pending records.

Use case:

- The remote skill appears pending because `StateStore.localRecords` is stale.
- Pre-check proves every effective installed target already has the same remote version.
- The user should not be asked to overwrite identical files.

Target IPC:

```typescript
reconcileInstalledSkill(pendingUpdateId: string): Promise<DesktopSyncState>
```

Rules:

- Main process re-runs detection and pre-check before reconciling.
- Reconcile is allowed only when all effective installed targets are `same` or covered by a same-version shared target.
- The action updates local records and removes the pending update.
- It must not create directories, download packages, or write agent skill files.
- It should appear in activity history as a local record sync, not a distribution.

## 12. IPC And Renderer Contract

Add or extend IPC methods:

```typescript
interface DesktopClientBridge {
  refreshSync(): Promise<DesktopSyncState>
  refreshAgentDetection(): Promise<AgentDetectionSnapshot>
  refreshPreDistributionCheck(): Promise<PreDistributionCheckSnapshot>
  distributePendingUpdate(pendingUpdateId: string): Promise<SkillDistributionResult>
  reconcileInstalledSkill(pendingUpdateId: string): Promise<DesktopSyncState>
}
```

Renderer rules:

- Home shows installed assistant count.
- Agents panel shows all 20 supported assistants with installed/missing/configured status.
- Updates and Home use pre-check results to decide whether to show distribute, reconcile, or disabled states.
- The confirmation dialog lists write targets and skipped/missing assistants before distribution starts.
- The dialog also covers the existing destructive distribution warning tracked as `DC-005`.

## 13. Security Rules

- Do not send raw API tokens, package contents, or filesystem file contents to the renderer.
- Skill IDs must continue to reject empty values, separators, `.`, and `..`.
- Path normalization must happen before dedupe.
- Write validation happens after detection and before install.
- Environment variable targets are user configured, not automatically trusted.
- Compatible read paths are displayed as explanatory metadata only; they are never joined with skill IDs for writes unless they are also an owned target.

## 14. Implementation File Map

Create:

| File | Responsibility |
| --- | --- |
| `src/adapters/agents/definitions.ts` | Catalog of 20 supported SKILL-capable assistants, env vars, default targets, compatible read paths. |
| `src/core/detection/agent-detection-service.ts` | Scan detection dirs, apply env overrides, select priority targets, dedupe shared paths, return snapshots. |
| `src/__tests__/agent-detection-service.test.ts` | Detection, env override, OpenClaw priority, shared path dedupe, Windows case-insensitive keys. |

Modify:

| File | Change |
| --- | --- |
| `src/types/index.ts` | Expand `AgentId`; add detection, target, distribution status, and reconcile types. |
| `src/adapters/agents/registry.ts` | Register 20 filesystem adapters from catalog definitions. |
| `src/core/runtime/runtime-config-manager.ts` | Build runtime agent detection snapshot from catalog instead of hardcoded roots. |
| `src/core/pre-distribution-check/pre-distribution-check-service.ts` | Check unique targets, fan out shared-path results to covered agents. |
| `src/core/distribution/distribution-service.ts` | Accept unique targets, skip same-version writes, mark shared coverage, update state only when coverage is complete. |
| `electron/ipc.ts` | Add detection refresh and reconcile channels. |
| `electron/preload.ts` | Expose detection refresh and reconcile methods. |
| `electron/main.ts` | Refresh detection on startup/manual refresh/pre-distribution; pass targets to pre-check and distribution. |
| `src/lib/ipc-client.ts` | Add bridge wrappers and unavailable-bridge fallbacks. |
| `src/app/App.tsx` | Store detection snapshot, drive confirmation/reconcile/distribution UI states. |
| `src/components/*` | Agents panel, Home metrics, pending update actions, result summaries. |
| `src/i18n/messages/*` | English and Chinese copy for detection, target statuses, confirmation, reconcile. |
| `src/__tests__/*` | Add focused coverage for catalog, runtime config, IPC bridge, renderer states, distribution results. |

Docs after implementation:

- `../ARCHITECTURE.md`
- `../SECURITY.md` if path validation or environment target semantics change
- `../references/runtime-and-storage-surface.md`
- `../QUALITY_SCORE.md` if scoring criteria change
- `../exec-plans/active/2026-04-27-agent-detection-and-distribution.md`

## 15. Test Strategy

Unit tests:

- agent catalog contains 20 supported IDs and no unsupported IDs
- env var override marks an assistant configured without auto detection dir
- OpenClaw priority selects the first existing target
- shared paths dedupe to one physical target
- Windows path dedupe is case-insensitive
- pre-check fans out one shared result to multiple covered assistants
- distribution writes one shared physical target once
- same-version targets do not write
- reconcile rejects unsafe or not-all-same cases

Renderer tests:

- Agents panel lists installed, missing, and environment-configured assistants
- Home metric shows installed assistant count
- pending item shows distribute when at least one target needs write
- pending item shows reconcile when all effective targets are same version
- confirmation dialog lists write, skipped, and missing assistants

Validation commands:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
```

## 16. Resolved Spec Issues

- The product spec now separates assistant read paths from desktop-owned write targets.
- Shared path handling is deterministic and based on normalized target paths, not async detection order.
- Environment variables are explicit target overrides but do not skip path safety or writability checks.
- Same-version targets no longer create a stuck pending item because a no-write local-record reconcile action is part of the design.
- Unsupported assistants remain informational only and do not participate in detection or distribution.

## 17. References

- Product spec: `../product-specs/2026-04-27-agent-detection-and-distribution.md`
- Skill path source: `../product-specs/2026-04-23-agents-skill-paths.md`
- Distribution v1 spec: `../product-specs/2026-04-17-skill-distribution-v1.md`
- Architecture: `../ARCHITECTURE.md`
- Security: `../SECURITY.md`
- Pre-check design: `pre-distribution-skill-check.md`
