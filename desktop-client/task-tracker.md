# Task Tracker

## In Progress

- No active items.

## Todo

- [ ] Persist distribution history if v1 still claims restart-safe activity history ✅ `desktop-client/docs/generated/state-db-schema.md` and the product spec agree on stored entities
- [x] Retire or explicitly archive the root `docs/superpowers/desktop-client*` drafts after the local canonical docs fully supersede them (2026-04-17) ✅ root drafts deleted, local docs updated to remove cross-references

## Done

- [x] Implement explicit package artifact cleanup ownership (2026-04-27) ✅ `npm test`, `npm run build`, and `python scripts/validate_agents_docs.py --level ERROR` pass
- [x] Implement pre-distribution skill checks for configured agent targets (2026-04-26) ✅ `npm test`, `npm run build`, and `python scripts/validate_agents_docs.py --level ERROR` pass
- [x] Expand the desktop client to `1984x1168` and reflow the Home view for wide-screen use (2026-04-24) ✅ the Electron renderer targets a physical `1984x1168` content area after display-scale conversion, the shell container and drawer widen with it, Home splits the metrics and review queue into a two-column layout, and the shell stays visible in Windows Alt+Tab
- [x] Convert desktop shell into a compact Windows notification-area utility (2026-04-24) ✅ `electron/main.ts` now hides the native menu, uses a tray-first window, keeps the app resident in the tray, and toggles visibility from the tray icon while remaining visible in task switching on Windows
- [x] Desktop client i18n: add local locale persistence, renderer translation, and locale-aware timestamps (2026-04-24) ✅ locale now persists through the Electron runtime config, renderer strings switch between `en-US` and `zh-CN`, and `npm test` / `npm run build` pass
- [x] Make config save/test fail fast when the Electron bridge is unavailable and time out stalled connection probes (2026-04-23) ✅ `src/app/App.tsx` now surfaces bridge-unavailable feedback, `src/core/runtime/api-connection.ts` adds a timeout-backed probe, and `npm test` plus `npm run build` pass
- [x] Fix desktop app icon loading and prevent duplicate client instances (2026-04-23) ✅ `electron/main.ts` uses a Windows-native `resources/icons/icon.ico` with the embedded SVG as fallback, and keeps Electron single-instance locking
- [x] Redesign desktop client UI information architecture (2026-04-23) ✅ Home focuses on pending reviews, Updates owns the full queue, and Settings drawer owns configuration/activity
- [x] Implement API token configuration UI and runtime reload path (2026-04-23) ✅ `npm run typecheck:electron`, `npm test`, and `npm run build` succeed
- [x] Create one canonical Electron start workflow for local development (2026-04-23) ✅ `desktop-client/package.json` exposes `npm run start:electron` and `desktop-client/README.md` documents the same command
- [x] Wire runtime auth bootstrap through `src/core/storage/secret-store.ts` (2026-04-23) ✅ `desktop-client/electron/main.ts`, `docs/SECURITY.md`, and `docs/product-specs/2026-04-17-skill-distribution-v1.md` describe the same auth bootstrap path
- [x] Scaffold the desktop-client sub-app (2026-04-17) ✅ `Get-ChildItem desktop-client/src,desktop-client/electron` lists renderer and Electron runtime directories
- [x] Normalize the desktop-client launcher doc system (2026-04-17) ✅ `Get-ChildItem desktop-client/task-tracker.md,desktop-client/docs/ARCHITECTURE.md,desktop-client/docs/DESIGN.md,desktop-client/docs/SECURITY.md,desktop-client/docs/QUALITY_SCORE.md,desktop-client/docs/design-docs,desktop-client/docs/references,desktop-client/docs/generated`
- [x] Verify the desktop client test and build paths after doc normalization (2026-04-17) ✅ `cd desktop-client && npm test && npm run build` succeeds
- [x] Verify the backend client API contract path referenced by the desktop app (2026-04-17) ✅ `uv run pytest tests/test_client_skills_api.py -q` succeeds
- [x] Separate canonical local docs from historical brainstorming drafts (2026-04-17) ✅ `desktop-client/AGENTS.md` quick entry points only to local docs
