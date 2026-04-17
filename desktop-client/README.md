# Desktop Client

Electron + Vite desktop shell for Open SkillHub.

## Local Run

```bash
cd desktop-client
npm install
```

For background polling, set these environment variables before starting Electron:

- `OPEN_SKILLHUB_API_BASE_URL` - backend base URL, for example `http://127.0.0.1:8001`
- `OPEN_SKILLHUB_API_TOKEN` - API token used by the main process poller
- `OPEN_SKILLHUB_POLL_INTERVAL_MS` - optional polling interval in milliseconds, defaults to `300000`
- `OPEN_SKILLHUB_CODEX_SKILLS_PATH` - optional override for the Codex skills directory
- `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH` - optional override for the Claude Code skills directory
- `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH` - optional override for the Gemini CLI skills directory

The current desktop pipeline expects the backend download API to return a plain ZIP payload. If your backend keeps `ENABLE_SKILL_DOWNLOAD_ENCRYPTION=true`, distribution will stop with a clear error until an official decryptor boundary is added.

```bash
npm run test
npm run build
```

`npm run build` runs the Electron TypeScript check and the Vite renderer build. The tray stays resident after the window is closed so background refreshes can continue.

## Current Scope

- Poll the backend for reviewable skill updates
- Show tray tooltip state and desktop notifications without auto-distributing
- Download and distribute an approved skill to every detected agent target
- Keep the renderer isolated behind the Electron preload bridge
- Provide a Vitest test path and a production build path
