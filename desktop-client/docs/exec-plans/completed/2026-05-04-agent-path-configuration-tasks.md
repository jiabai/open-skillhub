# Agent Path Configuration Task Checklist

Status: completed

## Documentation Gate

- [x] Review existing `definitions.ts`, `agent-detection-service.ts`,
  `config-store.ts`, `app-paths.ts`, `runtime-config-manager.ts`, `ipc.ts`,
  `agents-panel.tsx`, `settings-drawer.tsx`, `types/index.ts`, and related
  tests.
- [x] Create English product spec.
- [x] Create Chinese product spec.
- [x] Create execution plan.
- [x] Create this task checklist.
- [x] Update `docs/product-specs/index.md` with new spec entries.
- [x] Update `docs/exec-plans/active/index.md` with new plan entry.
- [x] Update `task-tracker.md` with this work item.
- [x] Update current architecture, security, AGENTS, and runtime reference docs
  to remove Agent path environment-variable override guidance.
- [x] Run documentation validation after all doc edits.

## Type And Definition Changes

- [x] Add `AgentPathsConfig` type to `src/types/index.ts`.
- [x] Remove `"environment"` from `AgentInstallSource` in `src/types/index.ts`.
- [x] Remove `envVar` field from `AgentPathDefinition` in
  `src/adapters/agents/definitions.ts`.
- [x] Remove all `envVar` values from `supportedAgentDefinitions` entries in
  `src/adapters/agents/definitions.ts`.

## Configuration Store

- [x] Add `agentPathsFilePath` to `AppPaths` in
  `src/core/storage/app-paths.ts`.
- [x] Add path validation utility for user-configured agent paths (reject
  empty, `..` traversal, relative, and unsafe paths).
- [x] Create agent paths config store using `createJsonConfigStore` in the
  main process.

## Detection Service Changes

- [x] Remove environment variable lookup logic from
  `agent-detection-service.ts` (the `env` dependency and
  `normalizeConfiguredPath` branch).
- [x] Add JSON config merge logic to `agent-detection-service.ts`: when a
  user-configured `targetPath` exists for an agent, it overrides the built-in
  `defaultTargets[0].path`.
- [x] Remove `"environment"` source handling from `resolveStatus()` in
  `agent-detection-service.ts`.
- [x] Update `AgentDetectionServiceDependencies` to accept agent paths config
  instead of `env`.

## IPC Changes

- [x] Add `agent-paths:read`, `agent-paths:save`, and
  `agent-paths:open-config-dir` channels to `electron/ipc.ts`.
- [x] Add bridge interface methods to `DesktopClientBridge` and
  `DesktopClientIpcHandlers` in `electron/ipc.ts`.
- [x] Register new IPC handlers in `registerDesktopClientIpc`.
- [x] Wire IPC handlers in `electron/main.ts`.
- [x] Expose bridge methods in `electron/preload.ts`.
- [x] Add IPC client methods in `src/lib/ipc-client.ts`.

## UI Changes

- [x] Add i18n string types for agent path config button in
  `src/i18n/messages/types.ts`.
- [x] Add English strings in `src/i18n/messages/en-US.ts`.
- [x] Add Chinese strings in `src/i18n/messages/zh-CN.ts`.
- [x] Add "Open Config Directory" button to `agents-panel.tsx`.
- [x] Wire the button to the `agent-paths:open-config-dir` IPC channel.

## Test Updates

- [x] Update `src/__tests__/agent-detection-service.test.ts` to remove
  environment variable test cases and add JSON config merge test cases.
- [x] Add tests for path validation utility.
- [x] Add tests for agent paths config store.
- [x] Update any tests that reference `"environment"` as an install source.

## Validation Gate

- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] `npm run typecheck:electron` passes.
- [x] `python scripts/validate_agents_docs.py --level ERROR` passes.
- [x] `git diff --check` passes.

## Archive Gate

- [x] Record validation results in the active plan.
- [x] Move this checklist and the plan to `docs/exec-plans/completed/` after
  validation is complete or document why the plan was superseded.
