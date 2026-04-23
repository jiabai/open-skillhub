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
```

`npm run dev` currently starts the Vite renderer only. `npm run build` is the
supported verification path for the renderer and Electron TypeScript code. The
repository does not yet expose one canonical Electron start command; that work
is tracked in `docs/exec-plans/index.md`.

When Electron is launched manually during development, the main process currently reads these environment variables:

- `OPEN_SKILLHUB_API_BASE_URL` - backend base URL, for example `http://127.0.0.1:8001`
- `OPEN_SKILLHUB_API_TOKEN` - current bootstrap token source for the main process poller
- `OPEN_SKILLHUB_POLL_INTERVAL_MS` - optional polling interval in milliseconds, defaults to `30000`
- `OPEN_SKILLHUB_CODEX_SKILLS_PATH` - optional override for the Codex skills directory
- `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH` - optional override for the Claude Code skills directory
- `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH` - optional override for the Gemini CLI skills directory

The current desktop pipeline expects the backend download path to be consumable as plain ZIP content after the server response is normalized. If your backend keeps encrypted downloads enabled end-to-end, distribution must stop with a clear error until an official decryptor boundary is added.

The current codebase contains a `secret-store` abstraction backed by `keytar`, but the Electron bootstrap path is not wired to it yet. Treat persistent token storage as planned capability rather than current behavior.

`npm run build` runs the Electron TypeScript check and the Vite renderer build. The tray stays resident after the window is closed so background refreshes can continue.

## Current Scope

- Poll the backend for reviewable skill updates
- Show tray tooltip state and desktop notifications without auto-distributing
- Download and distribute an approved skill to every detected agent target
- Keep the renderer isolated behind the Electron preload bridge
- Provide a Vitest test path and a production build path

## Canonical Docs

- Canonical desktop-client docs live under `desktop-client/docs/`
- Historical brainstorming and implementation plan drafts that previously lived in `docs/superpowers/` have been retired
