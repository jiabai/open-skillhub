# Agent Path Configuration

Status: canonical local product spec, implemented 2026-05-04

## Purpose

Replace environment-variable-based agent skill path overrides with a persistent
JSON configuration file managed through the desktop client. Users must be able
to customize where each agent's skills directory is located without setting
environment variables, and the desktop client must provide a UI entry point for
accessing and editing the configuration.

## Goals

- Add a persistent JSON configuration file (`agent-paths.json`) in the
  application config directory that stores per-agent skill target path
  overrides.
- Remove all `SKILLDRIVE_*_SKILLS_PATH` environment variable support from the
  agent detection and path resolution code paths.
- Establish a clear priority order: user JSON configuration overrides built-in
  defaults from `definitions.ts`.
- Provide a UI entry point in the Settings drawer for users to access and edit
  agent path configuration.
- Support cross-platform path formats: `~`-prefixed home-relative paths and
  platform-native absolute paths.
- Validate user-configured paths for safety before they are used in detection
  or distribution.
- Maintain all existing functionality: shared paths (`sharedPathKey`), agent
  detection, local skill scanning, and skill distribution.

## Non-Goals

- No in-app path editor with per-field input controls in v1. The UI entry point
  may open the configuration file directory for manual editing.
- No changes to the `AgentId` union type or the set of supported agents.
- No changes to `detectionDirs` resolution. Only `defaultTargets` paths are
  user-overridable.
- No changes to the backend API contract, sync state, or distribution
  semantics.
- No automatic path migration from environment variables. Users who previously
  relied on environment variables must reconfigure through the new JSON file.
- No support for adding custom agents beyond the built-in catalog.

## Configuration File

### Location

The configuration file is stored alongside the existing `config.json` in the
application config directory:

| Platform | Path |
|----------|------|
| Windows | `%LOCALAPPDATA%\SkillDrive\config\agent-paths.json` |
| macOS | `~/Library/Application Support/SkillDrive/config/agent-paths.json` |
| Linux | `~/.local/share/SkillDrive/config/agent-paths.json` |

The path follows the same `appPaths.configDir` convention used by the existing
`config-store.ts`.

### Format

```json
{
  "trae": {
    "targetPath": "~/custom-skills/trae"
  },
  "claude-code": {
    "targetPath": "D:/skills/claude"
  }
}
```

Each key is an `AgentId` from the built-in catalog. Each value object contains
a `targetPath` string that overrides the `defaultTargets[0].path` for that
agent.

### Priority

1. User JSON configuration (`agent-paths.json`)
2. Built-in defaults (`src/adapters/agents/definitions.ts`)

When the JSON file is missing, empty, or does not contain an entry for a given
agent, the built-in default is used.

### Path Resolution

User-configured paths are resolved by the existing `resolvePath()` function in
`agent-detection-service.ts`, which supports:

- `~` or `~/...` &mdash; resolved to the user's home directory
- Platform-native absolute paths &mdash; used as-is after normalization

No other shell expansions or variable substitutions are supported.

### Validation

Before a user-configured path is accepted:

- The path must not be empty after trimming.
- The raw or normalized path must not contain `..` path traversal segments.
- The path must be either `~`, `~/...`, or a platform-native absolute path.
- The resolved path must normalize to a valid directory string on the current
  platform.

Invalid entries in the JSON file are silently ignored, and the built-in default
is used instead.

## Environment Variable Removal

All `SKILLDRIVE_*_SKILLS_PATH` environment variable handling must be removed:

- Remove the `envVar` field from `AgentPathDefinition` in `definitions.ts`.
- Remove all `envVar` values from each entry in `supportedAgentDefinitions`.
- Remove environment variable lookup logic from `agent-detection-service.ts`.
- Remove the `AgentInstallSource` value `"environment"` and all code branches
  that reference it.
- Update `AgentInstallStatus.source` to only allow `"auto-detected"` or
  `"missing"`.
- Update UI labels that reference the `"environment"` source.

## UI Specification

### Entry Point

Add a button in the Settings drawer (inside or adjacent to the existing
`AgentsPanel`) that opens the `agent-paths.json` configuration file directory
in the system file manager. This allows users to manually edit the JSON file.

### Button Behavior

- On click, invoke an IPC channel that calls `shell.showItemInFolder()` or
  equivalent to open the config directory in Explorer (Windows), Finder (macOS),
  or the default file manager (Linux).
- If the `agent-paths.json` file does not exist, create it with an empty object
  `{}` before opening the directory so the user sees the file immediately.
- The main process should reveal `agent-paths.json` when supported and fall
  back to opening `appPaths.configDir` if the platform cannot reveal a file.

### Refresh After Edit

- After the user edits and saves the JSON file externally, they must click the
  existing "Rediscover" button in `AgentsPanel` to refresh agent detection.
- No filesystem watcher is required in v1.

### Layout Preservation

- The existing `AgentsPanel`, `SettingsPanel`, `ConfigPanel`, and
  `SettingsDrawer` layouts must not be restructured.
- The new button is additive only.

## IPC Changes

### New Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `agent-paths:read` | Renderer → Main | Read the current agent paths configuration |
| `agent-paths:save` | Renderer → Main | Write a partial or full agent paths configuration |
| `agent-paths:open-config-dir` | Renderer → Main | Open the config directory in the system file manager |

### Bridge Interface Additions

```typescript
getAgentPathsConfig(): Promise<AgentPathsConfig>
saveAgentPathsConfig(config: AgentPathsConfig): Promise<AgentPathsConfig>
openAgentPathsConfigDir(): Promise<void>
```

Where `AgentPathsConfig` is a `Partial<Record<AgentId, { targetPath: string }>>`.
`agent-paths:read` and `agent-paths:save` return only validated entries; invalid
or unknown entries are dropped before values are sent back to the renderer or
used by detection.

## Architecture Boundaries

- The JSON configuration is read and written by the Electron main process only.
- The renderer accesses configuration through typed IPC channels.
- Path resolution and validation remain in the main process.
- The existing `createJsonConfigStore` from `config-store.ts` is reused for
  file I/O.
- The existing `resolvePath()` in `agent-detection-service.ts` is reused for
  path normalization.
- The `agent-detection-service.ts` merges user configuration with built-in
  defaults at detection time.

## Security Requirements

- The renderer must not receive raw filesystem paths that have not been
  validated.
- Path validation must reject traversal, empty, and unsafe paths before they
  reach detection or distribution code.
- The JSON configuration file must be created with appropriate permissions
  (user-readable only on POSIX systems).
- No environment variable values are logged or persisted during the migration.
- Current desktop architecture, security, AGENTS, and runtime reference docs
  must be updated so they no longer advertise `SKILLDRIVE_*_SKILLS_PATH`
  overrides.

## Acceptance Criteria

- `agent-paths.json` is created in `appPaths.configDir` when the user opens
  the config directory or saves a configuration.
- User-configured paths override built-in defaults for agent detection and
  skill distribution.
- Missing or empty `agent-paths.json` falls back to built-in defaults with no
  errors.
- All `SKILLDRIVE_*_SKILLS_PATH` environment variable code is removed.
- The `AgentInstallSource` type no longer includes `"environment"`.
- The Settings drawer contains a button that opens the config directory in the
  system file manager.
- Clicking "Rediscover" after editing the JSON file picks up the new paths.
- Invalid paths in the JSON file are ignored gracefully.
- Shared path deduplication (`sharedPathKey`) continues to work with
  user-configured paths.
- `npm test`, `npm run build`, and `python scripts/validate_agents_docs.py
  --level ERROR` all pass.
- Current desktop runtime documentation points users to `agent-paths.json`
  instead of `SKILLDRIVE_*_SKILLS_PATH` variables for Agent skill path
  overrides.

## References

- Agent definitions: `../../src/adapters/agents/definitions.ts`
- Agent detection service: `../../src/core/detection/agent-detection-service.ts`
- Config store: `../../src/core/storage/config-store.ts`
- App paths: `../../src/core/storage/app-paths.ts`
- IPC channels: `../../electron/ipc.ts`
- Runtime config manager: `../../src/core/runtime/runtime-config-manager.ts`
