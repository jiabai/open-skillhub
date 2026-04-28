# Agent Detection And Targeted Distribution Implementation Plan

> For future implementation agents: follow this plan task by task after human review. Use `subagent-driven-development` or `executing-plans` only if the user explicitly authorizes delegated or inline execution. Steps use checkbox syntax in the sibling task file for progress tracking.

**Goal:** Expand the desktop client from 3 configured agent targets to 20 detected AI coding assistants, then distribute approved SKILL packages only to installed or explicitly configured targets.

**Architecture:** Move agent path rules into an adapter-owned catalog, add a main-process detection service that returns installation snapshots and unique physical write targets, and update pre-check/distribution flows to consume those targets. Renderer stays unprivileged and only displays IPC snapshots/actions.

**Tech Stack:** Electron main/preload IPC, React renderer, TypeScript core services, Vitest, existing filesystem adapter pattern.

---

## Status

`active`: documentation and planning are prepared; implementation has not started.

## Sources

- Product spec: `../../product-specs/2026-04-27-agent-detection-and-distribution.md`
- Technical design: `../../design-docs/agent-detection-and-distribution.md`
- Skill path source: `../../product-specs/2026-04-23-agents-skill-paths.md`
- Distribution v1 spec: `../../product-specs/2026-04-17-skill-distribution-v1.md`
- Execution checklist: `2026-04-27-agent-detection-and-distribution-tasks.md`

## Scope

- Expand supported SKILL-capable assistant IDs from 3 to 20.
- Add a data-driven agent catalog with detection directories, owned write targets, compatible read paths, env vars, priority path handling, and shared path keys.
- Add a detection service that produces renderer-safe install snapshots and core-safe unique targets.
- Replace `agentSkillsPaths` call sites with detection-derived effective targets, or keep a short transitional adapter only if all call sites cannot be removed in one task.
- Extend pre-distribution checks to support shared physical targets and fan-out results to covered assistants.
- Extend distribution to write each unique physical target once, skip same-version targets, and report shared-path coverage.
- Add a no-write reconcile action for stale pending records when every effective target already has the remote version.
- Update renderer UI, IPC, i18n, tests, and durable docs.

## Non-Goals

- No backend API changes.
- No automatic installation of missing assistants.
- No assistant executable, version, or running-process detection.
- No renderer filesystem access.
- No compatible read path writes unless that path is also an owned target.
- No manual path customization UI beyond environment variable overrides.
- No integration for Zed, AugmentCode, or JetBrains AI.

## File Map

Create:

| File | Responsibility |
| --- | --- |
| `src/adapters/agents/definitions.ts` | Catalog of supported assistants, env vars, detection dirs, owned targets, compatible read paths. |
| `src/core/detection/agent-detection-service.ts` | Scan install signals, apply env overrides, select priority targets, dedupe physical write targets. |
| `src/__tests__/agent-detection-service.test.ts` | Detection, env, priority, shared-path, and Windows key behavior. |

Modify:

| File | Change |
| --- | --- |
| `src/types/index.ts` | Expand `AgentId`; add detection, target, distribution status, and reconcile types. |
| `src/adapters/agents/registry.ts` | Register 20 filesystem adapters from catalog definitions. |
| `src/core/runtime/runtime-config-manager.ts` | Build agent detection snapshot from catalog-driven service. |
| `src/core/pre-distribution-check/pre-distribution-check-service.ts` | Accept detection-derived targets and fan out shared results. |
| `src/core/distribution/distribution-service.ts` | Use unique target requests, skip same-version writes, report shared coverage. |
| `electron/ipc.ts` | Add agent detection refresh and local-record reconcile channels. |
| `electron/preload.ts` | Expose detection refresh and reconcile bridge methods. |
| `electron/main.ts` | Refresh detection on startup, manual detection, pre-check, and distribution. |
| `src/lib/ipc-client.ts` | Add client wrappers and bridge-unavailable errors. |
| `src/app/App.tsx` | Hold detection state, trigger refreshes, wire distribution/reconcile UI. |
| `src/components/home-view.tsx` | Show installed assistant count and target-aware pending actions. |
| `src/components/updates-view.tsx` | Pass detection/pre-check/reconcile state into pending list. |
| `src/components/pending-updates-panel.tsx` | Show target statuses, confirmation entry points, and reconcile action. |
| `src/i18n/messages/en-US.ts` | Add English copy. |
| `src/i18n/messages/zh-CN.ts` | Add Chinese copy. |
| `src/__tests__/agent-adapters.test.ts` | Verify expanded adapter registration does not regress metadata reads. |
| `src/__tests__/pre-distribution-check-service.test.ts` | Cover shared target fan-out and same-version action mapping. |
| `src/__tests__/distribution-service.test.ts` | Cover target statuses, shared path dedupe, same-version skip, partial failure. |
| `src/__tests__/storage.test.ts` | Adjust runtime config expectations after detection snapshot changes. |
| `src/__tests__/app.test.tsx` | Cover detection UI states, reconcile action, confirmation behavior. |
| `docs/ARCHITECTURE.md` | After implementation, list detection core and expanded adapter surface as implemented. |
| `docs/SECURITY.md` | After implementation, document env target validation if semantics changed. |
| `docs/references/runtime-and-storage-surface.md` | After implementation, list new env vars, IPC methods, and runtime detection shape. |
| `task-tracker.md` | Track implementation progress and final validation. |

## Implementation Order

1. Types and catalog.
2. Detection service and tests.
3. Runtime config integration and main-process target helpers.
4. Pre-distribution check target migration.
5. Distribution target/status migration and reconcile service behavior.
6. IPC/preload/ipc-client bridge changes.
7. Renderer UI, confirmation dialog, i18n, and activity copy.
8. Docs updates for implemented behavior.
9. Full desktop and docs validation gates.

## Decisions

- Treat `../../design-docs/agent-detection-and-distribution.md` as the technical source for implementation details.
- Keep unsupported assistants static/informational only.
- Use environment variables as explicit configured targets, not as a way to bypass path safety.
- Deduplicate shared paths by normalized target path; on Windows, compare dedupe keys case-insensitively.
- Hide the distribution button when every effective target already has the same version, and provide a no-write local-record reconcile action instead.
- Keep sync service remote/local-record-only; it must not scan assistant directories.
- Keep pre-check snapshots transient in renderer state.

## Progress

- [x] Read root and desktop-client workflow/governance docs.
- [x] Reviewed the product spec against existing desktop-client code and docs.
- [x] Corrected product spec logic issues.
- [x] Added technical design for implementation handoff.
- [x] Created active ExecPlan and sibling task checklist.
- [ ] Human review of spec/design/plan before code.
- [ ] Implementation not started.

## Validation Plan

Documentation-only preparation:

```bash
python scripts/validate_agents_docs.py --level ERROR
```

Implementation validation later:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
```

## Validation Results

- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors and 0 warnings.
- Not run: desktop tests/build because this task intentionally stops before code implementation.

## Review Gate

Pause here for human review. Code implementation should not begin until the product spec, technical design, active ExecPlan, and task checklist are accepted or revised.
