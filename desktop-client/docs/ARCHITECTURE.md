# Desktop Client Architecture

## Overview

`desktop-client/` is the local Windows sync and distribution runtime for SkillDrive.
It polls the client API, compares remote skills against locally recorded state, surfaces pending updates for review, and distributes approved packages to supported agent skill directories.
The desktop shell is a tray-first window: it hides the native app menu,
shows in the Windows taskbar and Alt+Tab switcher, closes back to the notification area, and uses the tray icon to show or hide the window.
The current repository-verified workflows are test, build, renderer-only dev,
and the full desktop runtime launch through `npm run start:electron`.
Installer packaging is configured with `electron-builder`; the current release
scope is Windows installer validation. macOS packaging is tracked as a separate
exploratory path. Package extraction is cross-platform, but the initial macOS
`build.mac` configuration intentionally keeps Developer ID signing and
notarization disabled until a paid release path is approved and validated on
macOS.
The Linux CLI is a separate Node ESM runtime built from the same package. It
shares core agent, target, layout, package, and write services, but it does not
share Electron IPC, desktop config, desktop project records, or desktop sync
state.

## Code Map

- `electron/`
  - `main.ts`: privileged desktop runtime, tray, notifications, polling orchestration, and package download helpers
  - `preload.ts`: minimal safe bridge from renderer to Electron capabilities
  - `ipc.ts`: typed IPC contract between renderer and main process
- `src/app/`
  - `App.tsx`: root renderer composition and review-first state handling
- `src/components/`
  - desktop shell, Home, Updates, Local Skills, and Projects views, Settings drawer, theme toggle, local UI primitives, and supporting review panels
- `src/i18n/`
  - local locale dictionaries, provider, hook, formatting helpers, and language codes used by the renderer
- `src/cli/`
  - Linux command entry, command handlers, XDG config/state/cache resolution,
    local package preparation, target planning, server sync orchestration, and
    CLI output rendering
- `src/styles.css`
  - desktop renderer light/dark design tokens and shared component classes
- `src/core/sync/`
  - remote skill comparison, state refresh, and polling control
- `src/core/pre-distribution-check/`
  - read-only target-directory metadata checks, strict version comparison, transient snapshots, and stale-check fingerprints
- `src/core/distribution/`
  - package preparation, owned artifact cleanup, shared adapter write engine,
    desktop state reconciliation, and distribution result reporting
- `src/core/client-skills/`
  - shared Client API list/download contract parsing, auth headers, checksum and
    expiration validation, encrypted-download policy, and cache staging
- `src/core/skills/`
  - shared skill package tree safety helpers for root `SKILL.md`, symlink/path
    escape rejection, file count/size limits, and safe copy traversal
- `src/core/local-skills/`
  - read-only local skill inventory, server presence comparison, safe upload ZIP packaging, and Client API upload helper
- `src/core/projects/`
  - project-relative agent target resolution, project skill metadata parsing,
    on-demand project/global skill scan, and explicit project skill import
- `src/core/detection/`
  - catalog-driven assistant detection, JSON target overrides, OpenClaw priority target selection, and shared physical target dedupe
- `src/core/storage/`
  - app paths, JSON config, agent path overrides, secret storage, and SQLite-backed state
- `src/core/runtime/`
  - reloadable runtime configuration assembled from JSON config, secret store, environment bootstrap, cache, and agent detection snapshots
- `src/adapters/agents/`
  - catalog-backed filesystem adapters, per-agent package validation, layout-aware install, metadata read, and verification
- `src/lib/ipc-client.ts`
  - renderer wrapper around the preload-exposed bridge
- `src/types/`
  - shared contracts used across renderer, runtime, core services, and tests

## Module Relationships

Renderer UI -> `src/lib/ipc-client.ts` -> `electron/preload.ts` -> `electron/ipc.ts` -> `electron/main.ts`

`electron/main.ts` -> sync core + distribution core + storage + agent adapters

sync core -> shared Client Skill API + state store

runtime config -> agent detection service -> agent catalog + filesystem install signals

pre-distribution check core -> state store + detection-derived agent targets + configured agent adapters

distribution core -> package service + detection-derived agent targets + agent adapters + state store

Linux CLI -> CLI services + detection/project target resolution + shared
distribution write engine + CLI XDG sync state

local skills core -> detection-derived unique targets + shared package tree
safety + backend Client API + cache-owned temporary ZIP staging

project skills core -> persisted project records + catalog project targets +
shared package tree safety + filesystem scan/import services

shared Client Skill API -> backend Client API + cache-owned temporary package
staging

agent adapters -> local agent installations and skill directories

## Architecture Invariants

- Renderer code never reads Node or Electron privileged APIs directly.
- Polling, notifications, filesystem writes, token access, and local state persistence stay in the Electron main process.
- The Electron main process owns the single-instance lock; repeat launches focus the existing window instead of creating another runtime.
- The Windows shell behaves as a notification-area utility: resizable and maximizable BrowserWindow, no native menu bar, taskbar and Alt+Tab visibility, and tray click toggling.
- Window and tray icons prefer the Windows-native `resources/icons/icon.ico` on Windows, with the build-time embedded SVG from `resources/icons/icon.svg` kept as the fallback path.
- Sync code only compares remote and local state; it does not mutate agent skill directories.
- Pre-distribution checks are read-only and transient; results are returned through IPC for review context and are not persisted.
- Distribution only runs for explicitly approved pending updates.
- Agent detection merges validated `agent-paths.json` overrides with built-in
  catalog defaults before pre-check, reconcile, and distribution actions.
- Distribution writes each unique physical target at most once, marks shared-path coverage, and skips writing when every target is already same-version.
- Local Skills inventory is read-only. It resolves local package identity from
  `slug` when present, otherwise `name`. Uploads require an explicit row action,
  revalidate the selected row in the main process, and only create server-missing
  skills through the Client API.
- Projects inventory is on-demand and project-scoped. Project records persist in
  `config/projects.json`; project skill scans are transient; project skill
  import requires explicit source folder, writable project target, and overwrite
  flag when replacing an existing skill.
- Project skill targets are catalog metadata on `supportedAgentDefinitions`.
  Global home-directory targets are not reused for project scanning or import.
  Compatible project read paths can contribute rows but are not writable import
  targets.
- Theme preference is explicit runtime configuration. Missing or invalid theme
  values resolve to dark, and the renderer applies the current theme by toggling
  `.dark` on `document.documentElement`.
- Agent adapters own per-agent filesystem conventions, package installation, metadata reads, and install verification.
- Agent skill target layout is catalog metadata. Missing layout means flat
  `skills/<skill-name>`; categorized targets such as Hermes Agent use
  `skills/<category>/<skill-name>` through the shared layout resolver.
- Client skill list/download semantics live in `src/core/client-skills/` so the
  Electron runtime and Linux CLI share response normalization, checksum
  validation, expiration validation, and cache staging behavior.
- Skill package tree traversal safety lives in `src/core/skills/` so CLI local
  install, Local Skills upload packaging, and Project Skill import share the
  same symlink, path escape, root `SKILL.md`, file count, and size limit checks.
- Agent adapter install and metadata-read directory keys are server skill names; `remoteSkillId` remains the API/state identity and does not determine the local install directory.
- The Linux CLI has its own runtime state. Local `install` never updates remote
  sync state; server-backed `sync` updates CLI scoped sync records after
  successful writes.
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
- Locale and theme are persisted in `config/config.json` through `src/core/runtime/runtime-config-manager.ts` alongside the API Base URL
- Agent skill path overrides are persisted in `config/agent-paths.json`; only
  validated `targetPath` overrides for built-in Agent IDs are used at runtime.
- Project records are persisted in `config/projects.json` through
  `src/core/storage/project-config.ts`; removing a project removes only that
  JSON record and never deletes the project directory.
- `electron/main.ts` also creates a runtime `cache/` directory below the app root
- Runtime API token bootstrap is coordinated by `src/core/runtime/runtime-config-manager.ts`; it reads from the `keytar` secret store, with
  `SKILLDRIVE_API_TOKEN` as an explicit first-run seed and current-session
  fallback when secret storage is unavailable
- Encrypted skill package download support lives in the Electron main process.
  `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` must be provided for the current
  Electron session when backend download encryption is enabled; it is not
  persisted to config or exposed to the renderer.
- Saving or clearing API configuration reloads the in-memory runtime config so sync, package download, and distribution paths use the latest URL and token without an app restart
- `logs/` and `backups/` belong to the target design language but are not yet created by the current implementation
- State persistence currently stores sync snapshot data, not full per-run distribution history
- CLI sync state is stored separately from desktop state under the Linux XDG
  `skilldrive-cli` state directory. CLI records are scoped by global/project
  scope, target key, agent ID, and remote skill ID so global and project syncs
  do not overwrite each other.
- Runtime package downloads are staged in unique directories under `cache/`.
  Staging directories are temporary package artifacts and are removed through
  the package-service cleanup ownership contract after distribution succeeds or
  fails.
- Local Skills upload ZIPs are staged in unique `cache/local-upload-*`
  directories and removed by the main process after the upload attempt succeeds
  or fails.
- Project Skill Loading does not create cache artifacts. It validates and copies
  source skill folders directly from the Electron main process into the selected
  project target directory.
- Agent detection snapshots are runtime state only. They are rebuilt on runtime
  config reload, manual rediscovery, pre-distribution checks, reconcile, and
  distribution, and are not persisted to SQLite or JSON config.

## Packaging Surface

- `package.json` contains the `electron-builder` configuration and packaging
  scripts, plus the `skilldrive-agent` CLI `bin` entry and CLI build scripts.
- Windows packaging uses the `nsis` and `portable` targets with
  `resources/icons/icon.ico`.
- macOS `dmg` and `zip` targets are configured with `resources/icons/icon.icns`,
  `identity: null`, `forceCodeSigning: false`, and `notarize: false`. They are
  exploratory artifacts, not publishable release artifacts, until the macOS
  release plan and runbook gates are updated for a paid Developer ID path and
  pass on a macOS build machine.
- macOS release guidance lives in
  `docs/product-specs/2026-05-03-macos-release-packaging.md`,
  `docs/design-docs/macos-release-packaging.md`, and
  `docs/references/macos-release-runbook.md`.
- Installer artifacts are generated under `desktop-client/dist/` and are not
  repository source files.
- CLI build artifacts are generated under `desktop-client/dist-cli/` and are
  not repository source files.

## Key Files

- `electron/main.ts`
- `electron/preload.ts`
- `electron/ipc.ts`
- `src/app/App.tsx`
- `src/components/theme-toggle.tsx`
- `src/styles.css`
- `src/core/sync/sync-service.ts`
- `src/core/detection/agent-detection-service.ts`
- `src/core/distribution/distribution-service.ts`
- `src/core/distribution/distribution-write-service.ts`
- `src/core/distribution/package-service.ts`
- `src/core/client-skills/client-skill-api.ts`
- `src/core/skills/skill-package-tree.ts`
- `src/cli/main.ts`
- `src/core/local-skills/local-skill-inventory-service.ts`
- `src/core/local-skills/local-skill-upload-package.ts`
- `src/core/local-skills/local-skill-client-api.ts`
- `src/core/storage/config-store.ts`
- `src/core/storage/project-config.ts`
- `src/core/projects/project-agent-targets.ts`
- `src/core/projects/project-skill-scan-service.ts`
- `src/core/projects/project-skill-import-service.ts`
- `src/core/runtime/runtime-config-manager.ts`
- `src/core/storage/state-db.ts`
- `src/adapters/agents/base.ts`
