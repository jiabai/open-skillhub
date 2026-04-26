# Desktop Client Architecture

## Overview

`desktop-client/` is the local Windows sync and distribution runtime for Open SkillHub.
It polls the client API, compares remote skills against locally recorded state, surfaces pending updates for review, and distributes approved packages to supported agent skill directories.
The desktop shell is a tray-first window: it hides the native app menu,
shows in the Windows taskbar and Alt+Tab switcher, closes back to the notification area, and uses the tray icon to show or hide the window.
The current repository-verified workflows are test, build, renderer-only dev,
and the full desktop runtime launch through `npm run start:electron`.

## Code Map

- `electron/`
  - `main.ts`: privileged desktop runtime, tray, notifications, polling orchestration, and package download helpers
  - `preload.ts`: minimal safe bridge from renderer to Electron capabilities
  - `ipc.ts`: typed IPC contract between renderer and main process
- `src/app/`
  - `App.tsx`: root renderer composition and review-first state handling
- `src/components/`
  - desktop shell, Home and Updates views, Settings drawer, local UI primitives, and supporting review panels
- `src/i18n/`
  - local locale dictionaries, provider, hook, formatting helpers, and language codes used by the renderer
- `src/styles.css`
  - desktop renderer design tokens and shared component classes
- `src/core/sync/`
  - remote skill comparison, state refresh, and polling control
- `src/core/pre-distribution-check/`
  - read-only target-directory metadata checks, strict version comparison, transient snapshots, and stale-check fingerprints
- `src/core/distribution/`
  - package preparation, install orchestration, and distribution result reporting
- `src/core/storage/`
  - app paths, JSON config, secret storage, and SQLite-backed state
- `src/core/runtime/`
  - reloadable runtime configuration assembled from JSON config, secret store, environment bootstrap, cache, and agent paths
- `src/adapters/agents/`
  - Codex, Claude Code, and Gemini CLI path detection, validation, install, and verification
- `src/lib/ipc-client.ts`
  - renderer wrapper around the preload-exposed bridge
- `src/types/`
  - shared contracts used across renderer, runtime, core services, and tests

## Module Relationships

Renderer UI -> `src/lib/ipc-client.ts` -> `electron/preload.ts` -> `electron/ipc.ts` -> `electron/main.ts`

`electron/main.ts` -> sync core + distribution core + storage + agent adapters

sync core -> backend client API + state store

pre-distribution check core -> state store + configured agent adapters

distribution core -> package service + agent adapters + state store

agent adapters -> local agent installations and skill directories

## Architecture Invariants

- Renderer code never reads Node or Electron privileged APIs directly.
- Polling, notifications, filesystem writes, token access, and local state persistence stay in the Electron main process.
- The Electron main process owns the single-instance lock; repeat launches focus the existing window instead of creating another runtime.
- The Windows shell behaves as a notification-area utility: fixed-size BrowserWindow, no native menu bar, taskbar and Alt+Tab visibility, and tray click toggling.
- Window and tray icons prefer the Windows-native `resources/icons/icon.ico` on Windows, with the build-time embedded SVG from `resources/icons/icon.svg` kept as the fallback path.
- Sync code only compares remote and local state; it does not mutate agent skill directories.
- Pre-distribution checks are read-only and transient; results are returned through IPC for review context and are not persisted.
- Distribution only runs for explicitly approved pending updates.
- Agent adapters own per-agent filesystem conventions and install verification.
- Shared type contracts live in `src/types/` instead of being redefined across layers.

## Layer Boundaries

- UI layer: render status and invoke user actions only
- IPC layer: transport typed, serializable messages between renderer and main process
- Runtime layer: orchestrate polling, notifications, downloads, and platform integration
- Core service layer: compare state, prepare packages, and coordinate installs
- Adapter and storage layer: touch the filesystem, secrets, and local persistence

Dependencies should only point downward across those boundaries.

## Cross-Cutting Concerns

- Security: token handling, checksum validation, path validation, and log redaction
- Recoverability: pending updates, local install records, and activity history survive restarts
- Testability: renderer shell stays stable, most core logic is isolated from Electron UI state
- Documentation freshness: `AGENTS.md`, `task-tracker.md`, and `docs/exec-plans/index.md` must stay aligned with the implementation

## Current Persistence Surface

- App root path is computed by `src/core/storage/app-paths.ts`
- Current persisted directories are `config/` and `state/`
- API Base URL is persisted in `config/config.json` through `src/core/storage/config-store.ts`
- Locale is persisted in `config/config.json` through `src/core/runtime/runtime-config-manager.ts` alongside the API Base URL
- `electron/main.ts` also creates a runtime `cache/` directory below the app root
- Runtime API token bootstrap is coordinated by `src/core/runtime/runtime-config-manager.ts`; it reads from the `keytar` secret store, with
  `OPEN_SKILLHUB_API_TOKEN` as an explicit first-run seed and current-session
  fallback when secret storage is unavailable
- Saving or clearing API configuration reloads the in-memory runtime config so sync, package download, and distribution paths use the latest URL and token without an app restart
- `logs/` and `backups/` belong to the target design language but are not yet created by the current implementation
- State persistence currently stores sync snapshot data, not full per-run distribution history

## Key Files

- `electron/main.ts`
- `electron/preload.ts`
- `electron/ipc.ts`
- `src/app/App.tsx`
- `src/styles.css`
- `src/core/sync/sync-service.ts`
- `src/core/distribution/distribution-service.ts`
- `src/core/distribution/package-service.ts`
- `src/core/storage/config-store.ts`
- `src/core/runtime/runtime-config-manager.ts`
- `src/core/storage/state-db.ts`
- `src/adapters/agents/base.ts`
