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
- `npm run dist:mac` (exploratory macOS packaging command using the current
  unsigned `build.mac` configuration)

Packaging uses `electron-builder` configuration in `package.json` and writes
generated artifacts under `desktop-client/dist/`. The current release scope is
Windows installer validation. macOS packaging is tracked separately in
`macos-release-runbook.md`; the initial macOS configuration intentionally keeps
Developer ID signing and notarization disabled until the paid release path is
approved, configured, and validated on macOS.

## Environment Variables Read By The Runtime

- `SKILLDRIVE_API_BASE_URL`
- `SKILLDRIVE_API_TOKEN` (optional first-run secret-store bootstrap and
  current-session fallback if secret storage is unavailable)
- `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` (optional current-session
  backend download decryption secret; required only when encrypted downloads are
  enabled server-side)
- `SKILLDRIVE_POLL_INTERVAL_MS`
- `SKILLDRIVE_DESKTOP_DATA_DIR`

Agent skill path overrides live in `config/agent-paths.json`, not environment
variables. A valid non-empty `targetPath` for a built-in Agent ID marks that
assistant as configured even when its automatic detection directory does not
exist. Overrides replace that assistant's first owned write target only; they do
not turn compatible read paths into write targets.

## IPC Channels

Defined in `electron/ipc.ts`:

- `configuration:get`
- `configuration:save`
- `configuration:save-locale`
- `configuration:save-theme`
- `configuration:clear`
- `configuration:test-connection`
- `agent-paths:read`
- `agent-paths:save`
- `agent-paths:open-config-dir`
- `sync:refresh`
- `agent-detection:refresh`
- `local-skills:refresh`
- `local-skills:upload`
- `pre-distribution-check:refresh`
- `distribution:reconcile-installed`
- `distribution:run`
- `projects:list`
- `projects:add`
- `projects:rename`
- `projects:remove`
- `projects:select-folder`
- `projects:open-folder`
- `projects:scan-skills`
- `projects:select-skill-folder`
- `projects:validate-skill-folder`
- `projects:import-skill`

Renderer bridge methods:

- `getConfiguration()`
- `saveConfiguration(payload)`
- `saveLocale(locale)`
- `saveTheme(theme)`
- `clearConfiguration()`
- `testConnection(payload)`
- `getAgentPathsConfig()`
- `saveAgentPathsConfig(config)`
- `openAgentPathsConfigDir()`
- `refreshSync()`
- `refreshAgentDetection()`
- `refreshLocalSkills()`
- `uploadLocalSkill(rowKey)`
- `refreshPreDistributionCheck()`
- `reconcileInstalledSkill(pendingUpdateId)`
- `distributePendingUpdate(pendingUpdateId)`
- `listProjects()`
- `addProject(payload)`
- `renameProject(payload)`
- `removeProject(payload)`
- `selectProjectFolder()`
- `openProjectFolder(payload)`
- `scanProjectSkills(payload)`
- `selectProjectSkillFolder()`
- `validateProjectSkillFolder(payload)`
- `importProjectSkill(payload)`

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

The agent paths channels read, write, and reveal `config/agent-paths.json`.
Read/save responses return sanitized entries only. Opening the directory creates
a sample file first when the file does not exist. Generated sample target paths
live only inside `_comment`, so they do not mark agents as configured.

The project channels read and write `config/projects.json`, open native
directory pickers, reveal project folders, scan project-level skills, validate
source skill folders, and import source folders into catalog-defined project
targets. Filesystem reads and writes stay in the Electron main process. Import
resolves destination paths from persisted project state and catalog metadata,
never from renderer-provided destination paths. Project detail scans merge
global rows only from `~/.agents/skills`; other global agent skill directories
remain available to Local Skills but are not shown as global project-detail
rows.

## App Paths

Computed in `src/core/storage/app-paths.ts`:

```text
<app-root>/
  config/
    config.json
    agent-paths.json
    projects.json
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
- `agent-paths.json` stores optional per-Agent `{ "targetPath": "..." }`
  overrides after sanitization; missing or invalid entries fall back to catalog
  defaults
- `projects.json` stores user-added project records as
  `{ id, name, path, addedAt, updatedAt }`; invalid JSON falls back to an empty
  list, and duplicate names or normalized paths are rejected before write
- API token persistence uses the `keytar` secret store through `src/core/storage/secret-store.ts`
- `state.sqlite3` stores sync snapshot tables only
- package downloads and decrypted plaintext artifacts are written to unique
  staging directories below `cache/`; those directories are declared as
  cleanup-owned artifacts and removed after package extraction, installation
  success, installation failure, or package validation failure
- local skill upload ZIPs are written to unique `cache/local-upload-*`
  directories by the Electron main process and removed after the upload attempt
  succeeds or fails
- project skill import does not stage cache artifacts; it validates the source
  folder and copies directly into the selected project target directory after
  containment, conflict, symlink, file-count, and byte-size checks
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
- `codebuddy`
- `workbuddy`
- `hermes`

Default owned write targets are catalog-driven in
`src/adapters/agents/definitions.ts`, not hardcoded in `electron/main.ts`.
The standard targets are flat unless otherwise noted:

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
- CodeBuddy: `~/.codebuddy/skills`
- WorkBuddy: `~/.workbuddy/skills`
- Hermes Agent: categorized target `~/.hermes/skills/<category>/<skill>`,
  with SkillDrive-managed distribution using `general` as the deterministic
  default category

Cline/Warp/Codex and Amp/Kimi shared physical targets are deduped before
pre-check and distribution. Distribution writes a shared path once and reports
every covered assistant in the result.

Agent target layout metadata is carried through detection snapshots and project
target resolution. Missing layout means flat `skills/<skill-name>` behavior.
Categorized targets are scanned one category level deep, and pre-distribution
metadata reads fail closed when the same skill name appears in multiple
categories.

Project-relative skill targets are catalog-driven through
`supportedAgentDefinitions.projectTargets`. Current writable project target
candidates are:

- Claude Code: `.claude/skills`
- Cursor: `.cursor/skills`
- Windsurf: `.windsurf/skills`
- GitHub Copilot: `.copilot/skills`
- RooCode: `.roo/skills`
- Cline: `.agents/skills`
- Gemini CLI: `.gemini/skills`
- Codex: `.agents/skills`
- OpenCode: `.opencode/skills`
- KiloCode: `.kilocode/skills`
- Amp: `.config/agents/skills`
- Kiro: `.kiro/skills`
- Warp: `.agents/skills`
- Trae: `.trae/skills`
- Factory: `.factory/skills`
- Kimi Code CLI: `.config/agents/skills`
- Mistral Le Chat: `.vibe/skills`
- Pi Coding Agent: `.pi/agent/skills`
- Antigravity: `.gemini/antigravity/skills`

Cursor and OpenCode also declare compatible project read paths for project skill
scans. Compatible-read paths can contribute inventory rows but are not exposed
as writable import targets.
