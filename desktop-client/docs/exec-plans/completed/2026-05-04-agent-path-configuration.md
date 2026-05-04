# Agent Path Configuration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task after human review. Steps use checkbox
> (`- [ ]`) syntax in the sibling task file for progress tracking.

**Goal:** Replace environment-variable-based agent skill path overrides with a
persistent JSON configuration file, remove all `SKILLDRIVE_*_SKILLS_PATH`
environment variable support, and add a UI entry point for users to access and
edit agent path configuration.

**Architecture:** The existing `createJsonConfigStore` from `config-store.ts`
manages the new `agent-paths.json` file in `appPaths.configDir`. The
`agent-detection-service.ts` merges user configuration with built-in defaults
from `definitions.ts` at detection time. A new IPC channel and a button in the
Settings drawer allow users to open the config directory for manual editing.

**Tech Stack:** Electron, TypeScript, Vitest, existing config-store and
app-paths infrastructure.

---

## Scope

- Add `agent-paths.json` configuration file support with read/write/validate
  logic in the main process.
- Merge user-configured paths with built-in defaults in
  `agent-detection-service.ts`.
- Remove all `SKILLDRIVE_*_SKILLS_PATH` environment variable code from
  `definitions.ts`, `agent-detection-service.ts`, and related types.
- Remove `AgentInstallSource` value `"environment"` and all UI references.
- Add IPC channels for reading, saving, and opening the agent paths config.
- Add a button in the Settings drawer to open the config directory.
- Add i18n strings for the new UI elements.
- Update tests to cover the new configuration merge and validation logic.

## Non-Goals

- No in-app per-field path editor in v1.
- No filesystem watcher for automatic config reload.
- No automatic migration from environment variables.
- No changes to the `AgentId` union type or supported agent catalog.
- No changes to `detectionDirs` resolution.
- No changes to backend API contracts, sync state, or distribution semantics.

## Progress

- [x] 2026-05-04: Reviewed existing `definitions.ts`, `agent-detection-service.ts`,
  `config-store.ts`, `app-paths.ts`, `runtime-config-manager.ts`, `ipc.ts`,
  `agents-panel.tsx`, `settings-drawer.tsx`, `types/index.ts`, and related
  tests.
- [x] 2026-05-04: Created product spec in English and Chinese.
- [x] 2026-05-04: Created this execution plan and task checklist.
- [x] 2026-05-04: Reviewed the product spec, plan, task checklist, and current
  desktop runtime docs; expanded scope to update stale environment-variable
  path override references.
- [x] 2026-05-04: Implemented `agent-paths.json` storage, validation,
  detection merge logic, typed IPC/preload/client bridge methods, and the
  Settings drawer entry point.
- [x] 2026-05-04: Removed Agent path environment-variable support from current
  code paths and current desktop runtime docs.

## Decisions

- Configuration priority: user JSON > built-in defaults. No environment
  variable fallback.
- `agent-paths.json` uses `Partial<Record<AgentId, { targetPath: string }>>`
  format. Only `targetPath` is overridable; `detectionDirs` and
  `sharedPathKey` remain built-in only.
- Invalid entries in the JSON file are silently ignored; built-in defaults are
  used instead.
- v1 UI is a button that opens the config directory in the system file manager.
  Users edit the JSON file manually and click "Rediscover" to apply changes.
- The `AgentInstallSource` type is simplified to `"auto-detected" | "missing"`,
  removing `"environment"`.
- User-configured paths must be `~`, `~/...`, or platform-native absolute
  paths. Empty values, raw or normalized `..` segments, unknown agent IDs, and
  non-object entries are ignored.
- IPC read/save methods return the sanitized Agent path config, even though v1
  only exposes the open-directory button in the UI.

## File Map

Created:

| File | Responsibility |
|------|----------------|
| `docs/product-specs/2026-05-04-agent-path-configuration.md` | English product spec |
| `docs/product-specs/2026-05-04-agent-path-configuration-zh.md` | Chinese product spec |
| `docs/exec-plans/completed/2026-05-04-agent-path-configuration.md` | This completed execution plan |
| `docs/exec-plans/completed/2026-05-04-agent-path-configuration-tasks.md` | Completed task checklist |

Modified (planned):

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `AgentPathsConfig` type; remove `"environment"` from `AgentInstallSource` |
| `src/adapters/agents/definitions.ts` | Remove `envVar` field and all `envVar` values |
| `src/core/detection/agent-detection-service.ts` | Remove env var lookup; add JSON config merge logic |
| `src/core/storage/app-paths.ts` | Add `agentPathsFilePath` to `AppPaths` |
| `src/core/storage/agent-paths-config.ts` | Add config store, sanitization, and validation helpers |
| `electron/ipc.ts` | Add agent-paths IPC channels and bridge methods |
| `electron/main.ts` | Wire agent-paths IPC handlers |
| `electron/preload.ts` | Expose agent-paths bridge methods |
| `src/lib/ipc-client.ts` | Add agent-paths IPC client methods |
| `src/components/agents-panel.tsx` | Add "Open Config" button |
| `src/i18n/messages/en-US.ts` | Add English strings for new UI |
| `src/i18n/messages/zh-CN.ts` | Add Chinese strings for new UI |
| `src/i18n/messages/types.ts` | Add new i18n key types |
| `src/__tests__/agent-detection-service.test.ts` | Update tests for config merge and env var removal |
| `src/__tests__/storage.test.ts` | Add agent paths config store tests and runtime config merge coverage |
| `src/__tests__/app.test.tsx` | Update bridge/UI tests for the config directory button and source labels |
| `AGENTS.md` | Replace Agent path environment-variable guidance with JSON config guidance |
| `docs/ARCHITECTURE.md` | Replace environment target override language with JSON config override language |
| `docs/SECURITY.md` | Replace environment path safety guidance with JSON-config path validation guidance |
| `docs/references/runtime-and-storage-surface.md` | Document `agent-paths.json` and IPC channels; remove Agent path environment variables |
| `docs/product-specs/index.md` | Add new spec entry |
| `docs/exec-plans/active/index.md` | Remove archived plan entry |
| `docs/exec-plans/completed/index.md` | Add completed plan entry |
| `task-tracker.md` | Track this work |

## Implementation Tasks

See `2026-05-04-agent-path-configuration-tasks.md`.

## Validation Plan

```bash
cd desktop-client
npm test
npm run build
npm run typecheck:electron
cd ..
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

## Validation Results

- `npm test` passed: 20 test files, 113 tests.
- `npm run build` passed, including Electron typechecking and renderer/main/preload builds.
- `npm run typecheck:electron` passed.
- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors and 0 warnings.
- `git diff --check` passed; Git printed line-ending normalization warnings only.

## Outcome

Implemented. Users can configure built-in Agent target paths through
`config/agent-paths.json`, reveal that file from Settings, then click
"Rediscover" to rebuild detection with validated JSON overrides.
