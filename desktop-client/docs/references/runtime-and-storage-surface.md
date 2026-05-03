# Runtime And Storage Surface

## Current Verified Commands

- `npm test`
- `npm run build`
- `npm run dev` (renderer only)
- `npm run start:electron` (full Electron runtime)

`npm run start:electron` builds the renderer, builds the Electron main/preload
bundle into `dist-electron/`, and launches Electron through the package `main`
entry.

## Configured Packaging Commands

- `npm run pack` (unpacked output for the current platform)
- `npm run dist` (installer output for the current platform)
- `npm run dist:win` (Windows release packaging path)
- `npm run dist:mac` (macOS packaging command; release use requires the
  macOS release runbook gates)

Packaging uses `electron-builder` configuration in `package.json` and writes
generated artifacts under `desktop-client/dist/`. The current release scope is
Windows installer validation. macOS packaging is tracked separately in
`macos-release-runbook.md` and is not a release claim until the runtime no
longer depends on Windows-only package extraction, the app is Developer
ID-signed and notarized, and macOS smoke tests are recorded.

## Environment Variables Read By The Runtime

- `SKILLDRIVE_API_BASE_URL`
- `SKILLDRIVE_API_TOKEN` (optional first-run secret-store bootstrap and
  current-session fallback if secret storage is unavailable)
- `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` (optional current-session
  backend download decryption secret; required only when encrypted downloads are
  enabled server-side)
- `SKILLDRIVE_POLL_INTERVAL_MS`
- `SKILLDRIVE_CLAUDE_CODE_SKILLS_PATH`
- `SKILLDRIVE_CURSOR_SKILLS_PATH`
- `SKILLDRIVE_WINDSURF_SKILLS_PATH`
- `SKILLDRIVE_COPILOT_SKILLS_PATH`
- `SKILLDRIVE_ROOCODE_SKILLS_PATH`
- `SKILLDRIVE_CLINE_SKILLS_PATH`
- `SKILLDRIVE_GEMINI_CLI_SKILLS_PATH`
- `SKILLDRIVE_CODEX_SKILLS_PATH`
- `SKILLDRIVE_OPENCODE_SKILLS_PATH`
- `SKILLDRIVE_KILOCODE_SKILLS_PATH`
- `SKILLDRIVE_AMP_SKILLS_PATH`
- `SKILLDRIVE_KIRO_SKILLS_PATH`
- `SKILLDRIVE_WARP_SKILLS_PATH`
- `SKILLDRIVE_TRAE_SKILLS_PATH`
- `SKILLDRIVE_FACTORY_SKILLS_PATH`
- `SKILLDRIVE_KIMI_SKILLS_PATH`
- `SKILLDRIVE_MISTRAL_SKILLS_PATH`
- `SKILLDRIVE_PI_SKILLS_PATH`
- `SKILLDRIVE_ANTIGRAVITY_SKILLS_PATH`
- `SKILLDRIVE_OPENCLAW_SKILLS_PATH`
- `SKILLDRIVE_DESKTOP_DATA_DIR`

Agent skill path variables are explicit target overrides. A non-empty value
marks that assistant as configured even when its automatic detection directory
does not exist. Overrides replace that assistant's owned write target only; they
do not turn compatible read paths into write targets.

## IPC Channels

Defined in `electron/ipc.ts`:

- `configuration:get`
- `configuration:save`
- `configuration:save-locale`
- `configuration:save-theme`
- `configuration:clear`
- `configuration:test-connection`
- `sync:refresh`
- `agent-detection:refresh`
- `local-skills:refresh`
- `local-skills:upload`
- `pre-distribution-check:refresh`
- `distribution:reconcile-installed`
- `distribution:run`

Renderer bridge methods:

- `getConfiguration()`
- `saveConfiguration(payload)`
- `saveLocale(locale)`
- `saveTheme(theme)`
- `clearConfiguration()`
- `testConnection(payload)`
- `refreshSync()`
- `refreshAgentDetection()`
- `refreshLocalSkills()`
- `uploadLocalSkill(rowKey)`
- `refreshPreDistributionCheck()`
- `reconcileInstalledSkill(pendingUpdateId)`
- `distributePendingUpdate(pendingUpdateId)`

The agent detection channel returns a transient `AgentDetectionSnapshot` with
all supported assistant statuses, installed IDs, and deduped unique write
targets. The pre-distribution check channel reads the current pending updates
from the main-process StateStore and inspects detection-derived agent skill
directories through agent adapters. These snapshots are transient renderer state
only; they are not written to SQLite, JSON config, or agent directories.

The local skills channels return a transient inventory snapshot and upload a
server-missing local skill by row key. The renderer never sends arbitrary
filesystem paths for upload. The Electron main process recomputes the local
inventory, validates the row, creates the ZIP, calls the Client API upload
route, cleans temporary artifacts, and returns only the refreshed inventory plus
redacted upload result metadata.

The theme channel persists an explicit `light` or `dark` value in
`config/config.json`. Missing or invalid stored values resolve to `dark`. The
renderer uses the returned `ConfigurationState.theme` to toggle `.dark` on the
document root; theme changes do not touch secrets or sync state.

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
    local-upload-*/ # per-upload ZIP staging, removed after upload success or failure
```

Platform base directory rules:

- Windows: `%LOCALAPPDATA%/SkillDrive` or `%APPDATA%/SkillDrive`
- macOS: `~/Library/Application Support/SkillDrive`
- Linux: `$XDG_DATA_HOME/SkillDrive` or `~/.local/share/SkillDrive`
- Override: `SKILLDRIVE_DESKTOP_DATA_DIR`

## Current Storage Reality

- `config.json` stores non-secret runtime preferences such as API Base URL,
  locale, and theme; API token persistence remains separate from this file
- API token persistence uses the `keytar` secret store through `src/core/storage/secret-store.ts`
- `state.sqlite3` stores sync snapshot tables only
- package downloads and decrypted plaintext artifacts are written to unique
  staging directories below `cache/`; those directories are declared as
  cleanup-owned artifacts and removed after package extraction, installation
  success, installation failure, or package validation failure
- local skill upload ZIPs are written to unique `cache/local-upload-*`
  directories by the Electron main process and removed after the upload attempt
  succeeds or fails
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
