# Runtime And Storage Surface

## Current Verified Commands

- `npm test`
- `npm run build`
- `npm run dev` (renderer only)

There is not yet one canonical Electron runtime start command in `package.json`.

## Environment Variables Read By The Runtime

- `OPEN_SKILLHUB_API_BASE_URL`
- `OPEN_SKILLHUB_API_TOKEN`
- `OPEN_SKILLHUB_POLL_INTERVAL_MS`
- `OPEN_SKILLHUB_CODEX_SKILLS_PATH`
- `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH`
- `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH`
- `OPEN_SKILLHUB_DESKTOP_DATA_DIR`

## IPC Channels

Defined in `electron/ipc.ts`:

- `sync:refresh`
- `distribution:run`

Renderer bridge methods:

- `refreshSync()`
- `distributePendingUpdate(pendingUpdateId)`

## App Paths

Computed in `src/core/storage/app-paths.ts`:

```text
<app-root>/
  config/
    config.json
  state/
    state.json
    state.sqlite3
  cache/          # created at runtime by electron/main.ts
```

Platform base directory rules:

- Windows: `%LOCALAPPDATA%/OpenSkillHub` or `%APPDATA%/OpenSkillHub`
- macOS: `~/Library/Application Support/OpenSkillHub`
- Linux: `$XDG_DATA_HOME/OpenSkillHub` or `~/.local/share/OpenSkillHub`
- Override: `OPEN_SKILLHUB_DESKTOP_DATA_DIR`

## Current Storage Reality

- `config.json` path exists in the app-path model, but config persistence is not yet the primary auth bootstrap path
- `state.sqlite3` stores sync snapshot tables only
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
