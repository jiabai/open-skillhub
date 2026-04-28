# Agent Detection And Targeted Distribution Task Checklist

Status: active planning checklist; implementation not started.

Canonical plan: `2026-04-27-agent-detection-and-distribution.md`

## Task 0: Review Gate

**Files:**
- Review: `docs/product-specs/2026-04-27-agent-detection-and-distribution.md`
- Review: `docs/design-docs/agent-detection-and-distribution.md`
- Review: `2026-04-27-agent-detection-and-distribution.md`

- [ ] Confirm product behavior for owned targets, compatible read paths, shared path dedupe, and same-version reconcile.
- [ ] Confirm no code implementation should begin until this checklist is accepted.
- [ ] Record any review changes in the product spec, technical design, and this active plan.

## Task 1: Expand Types And Agent Catalog

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/adapters/agents/definitions.ts`
- Modify: `src/adapters/agents/registry.ts`
- Test: `src/__tests__/agent-adapters.test.ts`

- [ ] Expand `AgentId` to the 20 supported SKILL-capable assistant IDs.
- [ ] Add detection snapshot, install status, effective target, and distribution target status types.
- [ ] Create the agent catalog with env vars, detection dirs, default owned targets, compatible read paths, shared path keys, and OpenClaw priority behavior.
- [ ] Update registry construction so all 20 IDs have filesystem adapters.
- [ ] Add or update tests proving the registry includes 20 supported IDs and excludes unsupported assistants.
- [ ] Run `cd desktop-client && npm test -- src/__tests__/agent-adapters.test.ts`.

## Task 2: Build Agent Detection Service

**Files:**
- Create: `src/core/detection/agent-detection-service.ts`
- Test: `src/__tests__/agent-detection-service.test.ts`

- [ ] Write tests for auto-detected installed assistants based on detection directory existence.
- [ ] Write tests for environment override inclusion when detection dirs are missing.
- [ ] Write tests for OpenClaw priority target selection.
- [ ] Write tests for shared path dedupe across Cline/Warp and Amp/Kimi.
- [ ] Write tests for Windows case-insensitive dedupe keys.
- [ ] Implement the detection service with injectable filesystem, env, home dir, platform, and clock dependencies.
- [ ] Run `cd desktop-client && npm test -- src/__tests__/agent-detection-service.test.ts`.

## Task 3: Integrate Detection Into Runtime Config

**Files:**
- Modify: `src/core/runtime/runtime-config-manager.ts`
- Modify: `src/__tests__/storage.test.ts`
- Modify: `electron/main.ts`

- [ ] Replace hardcoded `agentPathEnvVars` and `defaultAgentRoots` with catalog-driven detection.
- [ ] Add `agentDetection` to `DesktopRuntimeConfig`.
- [ ] Migrate `getEnabledAgentIds()` and `getPreDistributionCheckTargets()` helpers toward detection-derived targets.
- [ ] Keep any temporary `agentSkillsPaths` compatibility shim documented in the active plan if it cannot be removed immediately.
- [ ] Update runtime config tests for env override and auto-detection behavior.
- [ ] Run `cd desktop-client && npm test -- src/__tests__/storage.test.ts`.

## Task 4: Update Pre-Distribution Check Targets

**Files:**
- Modify: `src/core/pre-distribution-check/pre-distribution-check-service.ts`
- Modify: `src/__tests__/pre-distribution-check-service.test.ts`
- Modify: `src/components/pre-distribution-check-summary.tsx`

- [ ] Change pre-check inputs from one `skillsPath` per `AgentId` to detection-derived `AgentSkillTarget[]`.
- [ ] Cache metadata reads by `remoteSkillId + targetPath`.
- [ ] Fan out shared physical target results to every covered assistant.
- [ ] Preserve snapshot fingerprint, TTL, timeout, and stale handling.
- [ ] Update UI summary copy so shared coverage is clear.
- [ ] Run `cd desktop-client && npm test -- src/__tests__/pre-distribution-check-service.test.ts`.

## Task 5: Update Distribution And Reconcile Behavior

**Files:**
- Modify: `src/core/distribution/distribution-service.ts`
- Modify: `src/__tests__/distribution-service.test.ts`
- Modify: `src/core/storage/state-db.ts` only if existing state helpers cannot support reconcile cleanly

- [ ] Change distribution request shape from `enabledAgentIds` to effective targets.
- [ ] Skip same-version targets without writing.
- [ ] Write each unique physical target once.
- [ ] Mark covered assistants as `covered-by-shared-path`.
- [ ] Keep pending update when any required write fails.
- [ ] Update local records when all effective targets are successful, covered, or skipped same-version.
- [ ] Implement no-write local record reconcile for all-same target states.
- [ ] Run `cd desktop-client && npm test -- src/__tests__/distribution-service.test.ts`.

## Task 6: Add IPC, Preload, And Client Bridge Methods

**Files:**
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/lib/ipc-client.ts`
- Modify: `electron/main.ts`
- Test: `src/__tests__/app.test.tsx`

- [ ] Add `agent-detection:refresh` IPC channel.
- [ ] Add `distribution:reconcile-installed` IPC channel.
- [ ] Expose bridge methods through preload.
- [ ] Add ipc-client wrappers and bridge-unavailable errors.
- [ ] Wire main handlers to refresh detection before pre-check/distribution/reconcile actions.
- [ ] Add app tests for bridge shape and unavailable bridge behavior.

## Task 7: Update Renderer Experience

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/components/home-view.tsx`
- Modify: `src/components/updates-view.tsx`
- Modify: `src/components/pending-updates-panel.tsx`
- Modify: `src/i18n/messages/en-US.ts`
- Modify: `src/i18n/messages/zh-CN.ts`
- Modify: `src/styles.css`
- Test: `src/__tests__/app.test.tsx`

- [ ] Store and refresh agent detection snapshots on app load and manual rediscovery.
- [ ] Show installed assistant count on Home.
- [ ] Convert Agents panel from static support info to dynamic installed/missing/configured status.
- [ ] Show distribution only when at least one effective target needs write.
- [ ] Show reconcile action when all effective targets are same-version.
- [ ] Add confirmation dialog copy that lists write targets, skipped targets, missing assistants, and destructive warning context.
- [ ] Add English and Chinese strings for new statuses and actions.
- [ ] Run `cd desktop-client && npm test -- src/__tests__/app.test.tsx`.

## Task 8: Update Durable Docs After Implementation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY.md` if path/env behavior changes beyond existing rules
- Modify: `docs/references/runtime-and-storage-surface.md`
- Modify: `task-tracker.md`
- Modify: `2026-04-27-agent-detection-and-distribution.md`

- [ ] Update architecture only after detection service and expanded adapters are implemented.
- [ ] Update security docs if implementation changes path validation or env target semantics.
- [ ] Update runtime reference with new env vars, IPC channels, and detection snapshot shape.
- [ ] Update task tracker status and validation notes.
- [ ] Update this active plan with implementation decisions and discoveries.

## Task 9: Final Validation

**Files:**
- Verify: whole `desktop-client/`
- Verify: repository docs

- [ ] Run `cd desktop-client && npm test`.
- [ ] Run `cd desktop-client && npm run build`.
- [ ] Run `python scripts/validate_agents_docs.py --level ERROR`.
- [ ] Record validation results in the active ExecPlan.
- [ ] Move the active plan to `../completed/` only after implementation is accepted and complete.
- [ ] Update `../active/index.md` and `../completed/index.md` when archiving.
