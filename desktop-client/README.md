# Desktop Client

Electron + Vite desktop shell for Open SkillHub.

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

- `OPEN_SKILLHUB_API_BASE_URL` - backend base URL, for example `http://127.0.0.1:8001`
- `OPEN_SKILLHUB_API_TOKEN` - optional first-run API token bootstrap; when the secret store is empty, the runtime stores this value through `keytar` and then reads the token from the secret store
- `OPEN_SKILLHUB_POLL_INTERVAL_MS` - optional polling interval in milliseconds, defaults to `30000`
- `OPEN_SKILLHUB_CODEX_SKILLS_PATH` - optional override for the Codex skills directory
- `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH` - optional override for the Claude Code skills directory
- `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH` - optional override for the Gemini CLI skills directory

The current desktop pipeline expects the backend download path to be consumable as plain ZIP content after the server response is normalized. If your backend keeps encrypted downloads enabled end-to-end, distribution must stop with a clear error until an official decryptor boundary is added.

If `keytar` is unavailable, `OPEN_SKILLHUB_API_TOKEN` can still be used for the
current session, but it is not persisted. API tokens must not be stored in
plaintext config, renderer state, or logs.

The tray stays resident after the window is closed so background refreshes can continue.

## Current Scope

- Poll the backend for reviewable skill updates
- Show tray tooltip state and desktop notifications without auto-distributing
- Download and distribute an approved skill to every detected agent target
- Keep the renderer isolated behind the Electron preload bridge
- Provide a Vitest test path and a production build path

## Canonical Docs

- Canonical desktop-client docs live under `desktop-client/docs/`
- Historical brainstorming and implementation plan drafts that previously lived in `docs/superpowers/` have been retired
