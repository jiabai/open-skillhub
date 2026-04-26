# Runtime And Storage Surface

## Current Verified Commands

- `npm test`
- `npm run build`
- `npm run dev` (renderer only)
- `npm run start:electron` (full Electron runtime)

`npm run start:electron` builds the renderer, builds the Electron main/preload
bundle into `dist-electron/`, and launches Electron through the package `main`
entry.

## Environment Variables Read By The Runtime

- `OPEN_SKILLHUB_API_BASE_URL`
- `OPEN_SKILLHUB_API_TOKEN` (optional first-run secret-store bootstrap and
  current-session fallback if secret storage is unavailable)
- `OPEN_SKILLHUB_POLL_INTERVAL_MS`
- `OPEN_SKILLHUB_CODEX_SKILLS_PATH`
- `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH`
- `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH`
- `OPEN_SKILLHUB_DESKTOP_DATA_DIR`

## IPC Channels

Defined in `electron/ipc.ts`:

- `configuration:get`
- `configuration:save`
- `configuration:save-locale`
- `configuration:clear`
- `configuration:test-connection`
- `sync:refresh`
- `pre-distribution-check:refresh`
- `distribution:run`

Renderer bridge methods:

- `getConfiguration()`
- `saveConfiguration(payload)`
- `saveLocale(locale)`
- `clearConfiguration()`
- `testConnection(payload)`
- `refreshSync()`
- `refreshPreDistributionCheck()`
- `distributePendingUpdate(pendingUpdateId)`

The pre-distribution check channel reads the current pending updates from the
main-process StateStore and inspects configured agent skill directories through
agent adapters. Its result is a transient renderer snapshot only; it is not
written to SQLite, JSON config, or agent directories.

## App Paths

Computed in `src/core/storage/app-paths.ts`:

```text
<app-root>/
  config/
    config.json
  state/
    state.json
    state.sqlite3
  cache/
    package-*/    # per-download package staging, removed after distribution cleanup
```

Platform base directory rules:

- Windows: `%LOCALAPPDATA%/OpenSkillHub` or `%APPDATA%/OpenSkillHub`
- macOS: `~/Library/Application Support/OpenSkillHub`
- Linux: `$XDG_DATA_HOME/OpenSkillHub` or `~/.local/share/OpenSkillHub`
- Override: `OPEN_SKILLHUB_DESKTOP_DATA_DIR`

## Current Storage Reality

- `config.json` path exists in the app-path model, but config persistence is not yet the primary auth bootstrap path
- API token persistence uses the `keytar` secret store through `src/core/storage/secret-store.ts`
- `state.sqlite3` stores sync snapshot tables only
- package downloads are written to unique staging directories below `cache/`;
  those directories are declared as cleanup-owned artifacts and removed after
  package extraction, installation success, installation failure, or package
  validation failure
- `logs/` and `backups/` are not yet created by the current implementation

## Agent Runtime Surface

Supported agent IDs:

- `codex`
- `claude-code`
- `gemini-cli`

Default detection roots in `electron/main.ts`:

- Codex: `~/.codex/skills`
- Claude Code: `~/.claude/skills`
- Gemini CLI: `~/.gemini/skills`
