# Desktop Client AGENTS.md

Guidance for AI coding agents working in `desktop-client/`.

## Scope

- This folder is the standalone desktop-app scaffold for Open SkillHub.
- Keep changes minimal and local to this sub-app unless a later task explicitly expands scope.
- Do not modify backend or web console files from here.
- The Electron main process owns polling, tray state, and notifications; the renderer must stay behind the preload bridge.

## Tech Stack

- Vite
- React 18
- TypeScript
- Vitest + jsdom + Testing Library

## Conventions

- Prefer a tiny app shell that is easy to render and test.
- Use the `@/` alias for imports from `src/`.
- Keep the first render target stable for smoke tests.

## Verification

- `npm run test`
- `npm run build`

## Runtime Notes

- Set `OPEN_SKILLHUB_API_BASE_URL` and `OPEN_SKILLHUB_API_TOKEN` to enable background polling from Electron.
- Use `OPEN_SKILLHUB_CODEX_SKILLS_PATH`, `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH`, and `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH` when auto-detected agent paths are not suitable.
- Polling should only refresh review state and surface pending updates; it must not auto-distribute skills.
- When the window closes, the tray should keep the app resident so review state stays current.
