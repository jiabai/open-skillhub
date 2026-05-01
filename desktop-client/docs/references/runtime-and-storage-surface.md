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
- `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET` (optional current-session
  backend download decryption secret; required only when encrypted downloads are
  enabled server-side)
- `OPEN_SKILLHUB_POLL_INTERVAL_MS`
- `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH`
- `OPEN_SKILLHUB_CURSOR_SKILLS_PATH`
- `OPEN_SKILLHUB_WINDSURF_SKILLS_PATH`
- `OPEN_SKILLHUB_COPILOT_SKILLS_PATH`
- `OPEN_SKILLHUB_ROOCODE_SKILLS_PATH`
- `OPEN_SKILLHUB_CLINE_SKILLS_PATH`
- `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH`
- `OPEN_SKILLHUB_CODEX_SKILLS_PATH`
- `OPEN_SKILLHUB_OPENCODE_SKILLS_PATH`
- `OPEN_SKILLHUB_KILOCODE_SKILLS_PATH`
- `OPEN_SKILLHUB_AMP_SKILLS_PATH`
- `OPEN_SKILLHUB_KIRO_SKILLS_PATH`
- `OPEN_SKILLHUB_WARP_SKILLS_PATH`
- `OPEN_SKILLHUB_TRAE_SKILLS_PATH`
- `OPEN_SKILLHUB_FACTORY_SKILLS_PATH`
- `OPEN_SKILLHUB_KIMI_SKILLS_PATH`
- `OPEN_SKILLHUB_MISTRAL_SKILLS_PATH`
- `OPEN_SKILLHUB_PI_SKILLS_PATH`
- `OPEN_SKILLHUB_ANTIGRAVITY_SKILLS_PATH`
- `OPEN_SKILLHUB_OPENCLAW_SKILLS_PATH`
- `OPEN_SKILLHUB_DESKTOP_DATA_DIR`

Agent skill path variables are explicit target overrides. A non-empty value
marks that assistant as configured even when its automatic detection directory
does not exist. Overrides replace that assistant's owned write target only; they
do not turn compatible read paths into write targets.

## IPC Channels

Defined in `electron/ipc.ts`:

- `configuration:get`
- `configuration:save`
- `configuration:save-locale`
- `configuration:clear`
- `configuration:test-connection`
- `sync:refresh`
- `agent-detection:refresh`
- `pre-distribution-check:refresh`
- `distribution:reconcile-installed`
- `distribution:run`

Renderer bridge methods:

- `getConfiguration()`
- `saveConfiguration(payload)`
- `saveLocale(locale)`
- `clearConfiguration()`
- `testConnection(payload)`
- `refreshSync()`
- `refreshAgentDetection()`
- `refreshPreDistributionCheck()`
- `reconcileInstalledSkill(pendingUpdateId)`
- `distributePendingUpdate(pendingUpdateId)`

The agent detection channel returns a transient `AgentDetectionSnapshot` with
all supported assistant statuses, installed IDs, and deduped unique write
targets. The pre-distribution check channel reads the current pending updates
from the main-process StateStore and inspects detection-derived agent skill
directories through agent adapters. These snapshots are transient renderer state
only; they are not written to SQLite, JSON config, or agent directories.

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
- package downloads and decrypted plaintext artifacts are written to unique
  staging directories below `cache/`; those directories are declared as
  cleanup-owned artifacts and removed after package extraction, installation
  success, installation failure, or package validation failure
- `logs/` and `backups/` are not yet created by the current implementation

## Agent Runtime Surface

Supported agent IDs:

- `claude-code`
- `cursor`
- `windsurf`
- `copilot`
- `roocode`
- `cline`
- `gemini-cli`
- `codex`
- `opencode`
- `kilocode`
- `amp`
- `kiro`
- `warp`
- `trae`
- `factory`
- `kimi`
- `mistral`
- `pi`
- `antigravity`
- `openclaw`

Default owned write targets are catalog-driven in
`src/adapters/agents/definitions.ts`, not hardcoded in `electron/main.ts`.
The standard targets are:

- Claude Code: `~/.claude/skills`
- Cursor: `~/.cursor/skills`
- Windsurf: `~/.codeium/windsurf/skills`
- GitHub Copilot: `~/.copilot/skills`
- RooCode: `~/.roo/skills`
- Cline: `~/.agents/skills`
- Gemini CLI: `~/.gemini/skills`
- Codex: `~/.agents/skills`
- OpenCode: `~/.config/opencode/skills`
- KiloCode: `~/.kilocode/skills`
- Amp: `~/.config/agents/skills`
- Kiro: `~/.kiro/skills`
- Warp: `~/.agents/skills`
- Trae: `~/.trae/skills`
- Factory: `~/.factory/skills`
- Kimi Code CLI: `~/.config/agents/skills`
- Mistral Le Chat: `~/.vibe/skills`
- Pi Coding Agent: `~/.pi/agent/skills`
- Antigravity: `~/.gemini/antigravity/skills`
- OpenClaw: first existing target from `~/.openclaw/skills`,
  `~/.clawdbot/skills`, `~/.moltbot/skills`

Cline/Warp/Codex and Amp/Kimi shared physical targets are deduped before
pre-check and distribution. Distribution writes a shared path once and reports
every covered assistant in the result.
