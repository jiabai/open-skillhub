# Tech Debt Tracker

| ID | Debt | Current Impact | Next Move |
|------|------|------|------|
| DC-001 | No canonical Electron start command | README cannot point to one supported end-to-end launch workflow | Finish the active bootstrap plan listed in `docs/exec-plans/index.md` |
| DC-002 | Secret-store abstraction is not wired into runtime bootstrap | Product and security posture still depend on env-only token startup | Wire `electron/main.ts` to `src/core/storage/secret-store.ts` or narrow the product contract |
| DC-003 | Local SQLite schema is narrower than the earlier design draft | Pending updates survive restarts, but full distribution history does not | Decide whether to extend the schema or lower the v1 promise |
| DC-004 | ~~Historical root drafts still exist beside local canonical docs~~ | ~~New agents may read the wrong source first if local indexes drift~~ | Resolved 2026-04-17: root drafts deleted, local docs are sole source |
| DC-005 | Distribution warning prompt not implemented | Users may accidentally lose local custom skills without understanding destructive consequences | Add confirmation dialog in `src/app/App.tsx` before `distributePendingUpdate()` call |
