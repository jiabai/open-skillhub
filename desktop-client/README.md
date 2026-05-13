# Desktop Client

Electron + Vite desktop shell for SkillDrive.

## Quick Links

- `AGENTS.md`
- `task-tracker.md`
- `docs/ARCHITECTURE.md`
- `docs/design-docs/core-beliefs.md`
- `docs/SECURITY.md`
- `docs/product-specs/2026-04-17-skill-distribution-v1.md`
- `docs/references/index.md`
- `docs/generated/state-db-schema.md`
- `docs/exec-plans/index.md`
- `docs/exec-plans/tech-debt-tracker.md`

## Local Run

```bash
cd desktop-client
npm install
npm test
npm run build
npm run dev
npm run start:electron
```

`npm run dev` starts the Vite renderer only. `npm run start:electron` is the
canonical local command for the full desktop runtime: it builds the renderer,
builds the Electron main/preload bundle, and launches Electron from
`dist-electron/main.js`. `npm run build` is the supported verification path for
the renderer, Electron TypeScript code, and Electron runtime bundle.

The Electron main process reads these environment variables during local development:

- `SKILLDRIVE_API_BASE_URL` - backend base URL, for example `http://127.0.0.1:8001`
- `SKILLDRIVE_API_TOKEN` - optional first-run API token bootstrap; when the secret store is empty, the runtime stores this value through `keytar` and then reads the token from the secret store
- `SKILLDRIVE_POLL_INTERVAL_MS` - optional polling interval in milliseconds, defaults to `30000`
- `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` - optional current-session secret for encrypted skill downloads; set it to the backend `SECRET_KEY` only when `ENABLE_SKILL_DOWNLOAD_ENCRYPTION=true`
- `SKILLDRIVE_CODEX_SKILLS_PATH` - optional override for the Codex skills directory
- `SKILLDRIVE_CLAUDE_CODE_SKILLS_PATH` - optional override for the Claude Code skills directory
- `SKILLDRIVE_GEMINI_CLI_SKILLS_PATH` - optional override for the Gemini CLI skills directory

The desktop runtime can distribute encrypted downloads when `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` is present in the Electron main-process environment and matches the backend `SECRET_KEY` used for download encryption. The secret is not stored in JSON config, renderer state, or logs. If encrypted downloads are enabled but this secret is missing or wrong, distribution fails closed before extraction or agent-directory writes.

If `keytar` is unavailable, `SKILLDRIVE_API_TOKEN` can still be used for the
current session, but it is not persisted. API tokens must not be stored in
plaintext config, renderer state, or logs.

The tray stays resident after the window is closed so background refreshes can continue.

## Packaging

Windows installer packaging is configured through `electron-builder`. The v1
release target is the Windows installer path; macOS builder settings may exist
for exploratory builds, but macOS runtime distribution is not a release claim
until non-Windows package extraction and smoke tests are implemented.

```bash
cd desktop-client
npm install
npm run build
npm run dist:win
```

Windows release artifacts are written under `dist/`, including a `.exe` NSIS
installer and `win-unpacked/` for smoke testing. `dist/` is generated local
output and should not be committed.

Additional configured packaging scripts:

- `npm run pack` - build unpacked output for the current platform
- `npm run dist` - build installer output for the current platform
- `npm run dist:mac` - exploratory macOS packaging command using the current
  unsigned `build.mac` configuration; public release use remains deferred until
  a paid Developer ID signing and notarization path is approved and validated

macOS release preparation lives in
`docs/product-specs/2026-05-03-macos-release-packaging.md` and the operator
runbook lives in `docs/references/macos-release-runbook.md`.

## Current Scope

- Poll the backend for reviewable skill updates
- Show tray tooltip state and desktop notifications without auto-distributing
- Download and distribute an approved skill to every detected agent target
- Keep the renderer isolated behind the Electron preload bridge
- Provide a Vitest test path and a production build path

## Canonical Docs

- Canonical desktop-client docs live under `desktop-client/docs/`
- Historical brainstorming and implementation plan drafts that previously lived in `docs/superpowers/` have been retired

---

## Manual Testing Guide

This section walks you through the complete end-to-end experience for manually
testing the desktop client locally, from first launch to skill distribution.

### Prerequisites

1. **Backend running**: The SkillDrive backend must be accessible. Start it with:
   ```bash
   uv run uvicorn backend.api_app:app --host 0.0.0.0 --port 8001
   ```
   Or via Docker:
   ```bash
   docker compose up -d api
   ```

2. **API token**: You need a valid bearer token from the backend. Obtain one
   through the web console login or backend API.

3. **Node.js**: Ensure Node.js 18+ is installed.

4. **Dependencies installed**: Run `npm install` in the `desktop-client/` directory.

### Step 1: First Launch

Open a terminal and start the full desktop runtime:

```bash
cd desktop-client
npm run start:electron
```

The Electron window will open. On first launch you will see:

- **Home view** with the "Review updates" heading
- A warning callout: **"API token needed"** — review sync is paused until configuration is saved
- Three metric cards showing: Pending updates (0), Local records (0), Last refresh ("Not refreshed yet")
- A "Needs review" section showing "No pending updates are waiting for review."
- A system tray icon appears in the Windows taskbar

### Step 2: Configure API Connection

1. Click the **"Settings"** button in the header bar (or the "Configure API" button in the warning callout).

2. The Settings drawer slides in from the right. You will see:
   - **Bridge status** card showing connection state
   - **Configuration** card with two fields:
     - **API Base URL**: pre-filled with `http://127.0.0.1:8001`
     - **API Token**: empty password field

3. Fill in the fields:
   - **API Base URL**: Enter your backend URL (e.g., `http://127.0.0.1:8001`)
   - **API Token**: Paste your bearer token

4. **Test the connection** (optional but recommended):
   - Click **"Test connection"**
   - A success or error message appears below the form
   - Success confirms the URL is reachable and the token is accepted

5. **Save the configuration**:
   - Click **"Save configuration"**
   - The drawer shows a "Configuration saved" activity entry
   - The app automatically triggers a review sync after saving

6. Close the Settings drawer by clicking the close button or clicking outside.

### Step 3: Verify Sync State

After saving configuration, the Home view refreshes automatically:

- **Pending updates** metric shows the count of skills awaiting review
- **Local records** metric shows previously distributed skills
- **Last refresh** shows the timestamp of the latest sync
- The header badge updates to show `N pending`
- The **Activity panel** (in Settings) logs "Review snapshot loaded"

If there are pending updates, they appear in the **"Needs review"** card:
- Skill name and ID
- Local version vs Remote version badges
- Reason badge (e.g., "new", "version update")
- A **"Distribute"** button for each item

### Step 4: Review and Distribute a Skill

1. On the Home view, locate a pending update in the "Needs review" card.

2. Click **"Distribute"** next to the skill you want to install.

3. The button changes to **"Distributing..."** while the operation runs.

4. After distribution completes:
   - The skill is removed from the pending list
   - The Activity panel logs "Distribution completed" (success) or "Distribution completed with warnings" (partial failure)
   - The Local records metric increments
   - The Pending updates metric decrements

5. To see all pending updates (not just the top 3), click **"View all updates"** or switch to the **Updates** tab in the header navigation.

### Step 5: Navigate Views

The header contains two navigation buttons:

- **Home**: Overview dashboard with preview of pending updates and quick actions
- **Updates**: Full queue of all pending updates with individual distribute buttons

Switch between them to verify both views render correctly.

### Step 6: Check Agent Targets

Open the Settings drawer and scroll to the **Agents** panel:

- Lists supported distribution targets: **Claude Code**, **Codex**, **Gemini CLI**
- Shows detection status for each agent's skill directory
- This panel is informational; no interactive controls

### Step 7: Review Activity History

In the Settings drawer, the **Activity** panel shows recent events:

- **Neutral** entries: info messages (e.g., "Console ready", "Review snapshot loaded")
- **Success** entries: completed operations (e.g., "Configuration saved", "Distribution completed")
- **Warning** entries: issues or failures (e.g., "Refresh failed", "Distribution failed")

Each entry shows a title, detail text, and timestamp.

### Step 8: Refresh State Manually

- Click the **"Refresh"** button in the header
- Or click **"Refresh state"** on the Home view
- The app re-polls the backend and updates the pending queue
- The Last refresh timestamp updates

### Step 9: Clear Configuration (Reset)

To reset the client to its pre-configured state:

1. Open the Settings drawer
2. Scroll to the **Configuration status** section
3. Click **"Clear configuration"**
4. The token is removed from the secret store
5. The app returns to the "API token needed" state
6. The Settings drawer opens automatically for re-configuration

### Step 10: Window Close and Tray Behavior

- **Close the window** (click the X button): The window closes but the app stays resident in the system tray
- **Background polling continues**: The tray icon remains active and polling the backend
- **Re-open the window**: Click the tray icon to restore the window
- **Exit the app completely**: Right-click the tray icon and select Quit (or use the context menu)

### Step 11: Environment Variable Bootstrap (Optional)

For automated first-run setup, launch with environment variables:

```powershell
$env:SKILLDRIVE_API_BASE_URL = "http://127.0.0.1:8001"
$env:SKILLDRIVE_API_TOKEN = "your-token-here"
$env:SKILLDRIVE_POLL_INTERVAL_MS = "15000"
npm run start:electron
```

The token is stored in the `keytar` secret store on first launch. Subsequent
launches read from the secret store, so you do not need to re-enter credentials.

### Step 12: Renderer-Only Development (Optional)

For faster UI iteration without the full Electron runtime:

```bash
cd desktop-client
npm run dev
```

This starts the Vite dev server for the React renderer only. The desktop bridge
will be unavailable, so the UI shows a "Desktop bridge unavailable" warning.
This is expected — use `npm run start:electron` for full integration testing.

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Desktop bridge unavailable" | Running `npm run dev` instead of `npm run start:electron` | Use `npm run start:electron` for full runtime |
| "API token needed" persists after saving | Backend unreachable or token invalid | Click "Test connection" to diagnose |
| "Refresh failed" errors | Backend not running or network issue | Verify backend is up at the configured URL |
| Distribution fails on all agents | No agent skill directories detected | Check that Codex/Claude Code/Gemini CLI are installed locally |
| Encrypted package decryption fails | `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` is missing or does not match the backend `SECRET_KEY` | Set the env var for the current Electron session, or disable backend download encryption for local development |
| Tray icon missing | Electron failed to start | Check terminal output for errors |
| `keytar` build errors on Windows | Missing build tools for native module | Install Visual Studio Build Tools with C++ workload |

### Verification Commands

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check Electron code
npm run typecheck:electron

# Full build (renderer + Electron)
npm run build

# Backend API tests (from repo root)
uv run pytest tests/test_client_skills_api.py -q
```
