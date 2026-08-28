# Tech Debt Tracker

| ID | Debt | Current Impact | Next Move |
|------|------|------|------|
| DC-001 | ~~No canonical Electron start command~~ | ~~README cannot point to one supported end-to-end launch workflow~~ | Resolved 2026-04-23: `npm run start:electron` launches the full desktop runtime |
| DC-002 | ~~Secret-store abstraction is not wired into runtime bootstrap~~ | ~~Product and security posture still depend on env-only token startup~~ | Resolved 2026-04-23: runtime bootstrap reads the `keytar` secret store with env as first-run seed/session fallback |
| DC-003 | ~~Local SQLite schema is narrower than the earlier design draft~~ | ~~Pending updates survive restarts, but full distribution history does not~~ | Resolved 2026-08-28: lowered the v1 promise. v1 spec (EN/ZH) now states activity history is session-scoped and not persisted; restart-safe persistence is scoped to the pending queue + distributed snapshot; persistent history/backups documented as v1 non-goals; `docs/generated/state-db-schema.md` corrected to match the code |
| DC-004 | ~~Historical root drafts still exist beside local canonical docs~~ | ~~New agents may read the wrong source first if local indexes drift~~ | Resolved 2026-04-17: root drafts deleted, local docs are sole source |
| DC-005 | ~~Distribution warning prompt not implemented~~ | ~~Users may accidentally lose local custom skills without understanding destructive consequences~~ | Resolved 2026-04-28: `src/app/App.tsx` shows a confirmation dialog with write targets, skipped targets, missing assistants, and destructive warning copy before calling `distributePendingUpdate()` |
