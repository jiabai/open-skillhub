# Completed Exec Plans

## Archived Plans

| File | Outcome |
|------|---------|
| `2026-08-28-merge-desktop-task-tracker-into-exec-plans-plan.md` | Desktop task state moved into the ExecPlan system; redundant desktop-client/task-tracker.md retired and all references removed, validator updated |
| `2026-08-28-merge-desktop-task-tracker-into-exec-plans-tasks.md` | Execution checklist completed; docs validator passes with 0 errors |
| `backend-consolidation-refactor-plan.md` | Backend error/response unification, skills API boundary cleanup, SkillService split, legacy fallback centralization, app composition layer slimming |
| `backend-consolidation-refactor-tasks.md` | 6-milestone execution checklist; all milestones completed with passing regression tests and ruff checks |
| `docker-healthcheck-standardization-plan.md` | Docker startup, migration, logging, and readiness standardization completed with end-to-end Compose runtime validation |
| `docker-healthcheck-standardization-tasks.md` | Final Docker validation checklist completed; migrate exited cleanly, api became healthy, readyz returned 200, and Docker logs were verified |
| `frontend-i18n-plan.md` | Frontend i18n infrastructure and first migration batch |
| `landing-page-light-mode-plan.md` | Public light-mode Landing Page implemented at `/` with Agent Skill Control Room visual, public AppShell boundary, i18n copy, and HSL token cleanup |
| `landing-page-light-mode-tasks.md` | Landing Page execution checklist completed with frontend lint, tests, build, and docs validation |
| `profile-identity-settings-center-plan.md` | `/profile` redesigned into an identity-first account center |
| `runtime-config-capabilities-plan.md` | Runtime capability contract moved to the backend and consumed by the frontend |
| `runtime-config-capabilities-tasks.md` | Implementation checklist preserved after the runtime capability migration completed |
| `user-status-followup-plan.md` | User-status build-time catalog sync completed; broader enum consolidation moved into a new follow-up plan |
| `content-hash-dedup-plan.md` | Content hash (SHA-256) replaced version-string comparison for skill distribution dedup; three-state sync model (installed/not-installed/update) implemented across backend and desktop client |
| `content-hash-dedup-tasks.md` | 4-phase execution checklist completed; backend hash computation, API exposure, desktop client sync logic, and full validation all passed |
| `public-skill-import-cli-plan.md` | Host-side single-skill public import command for preprod; targeted import with storage-root override, 12 tests, API endpoints, and frontend page completed |
| `public-skill-import-cli-tasks.md` | 5-task checklist completed; all implementation and validation steps marked done with 12 passing tests |
| `client-skills-upload-plan.md` | API-token-only Client API ZIP upload endpoint completed; new `POST /api/v1/client/skills/upload` supports skill creation and version append with full validation (mypy, 635 pytest, ruff, docs) passing |
| `client-skills-upload-tasks.md` | 5-task execution checklist for Client API upload implementation; all tasks marked done with full backend validation passing |
| `error-architecture-refactor-plan.md` | Backend verification errors now use canonical exceptions, auth/users routers share presenter-based payloads, tool errors share the same payload model, and backend/docs gates passed |
| `enum-catalog-consolidation-plan.md` | Skill visibility moved to a shared authored catalog with synced backend/frontend runtime copies; role remains config-backed and skill_kind remains backend-derived |
| `skills-api-boundary-plan.md` | Console skill routes are documented and regression-tested as JWT/RBAC-only, Client skill list/download/upload remain API-token-only, and frontend Client API download helpers now require explicit API tokens |
| `backend-engineering-refactor-plan.md` | Batch A middleware infrastructure refactor completed: request logging and global rate limiting now use pure ASGI middleware, duplicate logging-layer 500 shaping was removed, and distributed rate-limit storage remains tracked debt |
| `backend-engineering-refactor-tasks.md` | 4-task Batch A checklist completed with focused middleware tests and full backend/docs hard gates passing |
| `runtime-capabilities-enhancement-plan.md` | Runtime capability follow-up completed with expanded backend derivation tests, frontend permission helper boundary, navigation wiring, and capability contract documentation |
| `runtime-capabilities-enhancement-tasks.md` | Runtime capability enhancement checklist completed with backend/frontend/docs gates passing |
| `refresh-token-hardening-plan.md` | Stateful single-use refresh-token rotation implemented with persisted token families, reuse detection, user-wide JWT revocation on compromise, logout session revocation, and backend/docs gates passing |
| `refresh-token-hardening-tasks.md` | Refresh-token hardening checklist completed with focused rotation tests, full backend pytest, ruff, mypy, Alembic upgrade, and docs validation passing |
| `help-center-plan.md` | Help Center implemented at `/help` with i18n content, docs directory, public route access, AppShell help entry, and frontend validation passing |
| `documentation-freshness-automation-plan.md` | Repository docs validator extended with 4 new checks: reverse index consistency, plan/task pairing, tech-debt source link existence, and completed plan status validation; 21 tests passing |
| `documentation-freshness-automation-tasks.md` | 4-task implementation checklist completed with full validator test coverage and docs gate passing |
| `local-skill-grouping-plan.md` | Local Skills same-name grouping implemented: `LocalSkillGroupRow` type, `groupSkillRowsByName` aggregation, path tags, version conflict detection, batch delete via `groupRowKeys`, i18n keys, backward-compatible fallback, all 190 tests passing, build succeeding, and docs validation clean |
| `local-skill-grouping-tasks.md` | 9-task execution checklist completed; types, grouping logic, UI rewrite, batch operations, i18n, test fixtures, and full validation passed |
| `skill-delete-confirmation-plan.md` | Delete confirmation dialog with destructive confirm (type-to-confirm) implemented in Local Skills view; shows full paths, agent ownership, permanent deletion warning; 8 new i18n keys, 5 new test cases, 195 tests passing, build succeeding |
| `skill-delete-confirmation-tasks.md` | 4-task execution checklist completed; i18n keys, dialog UI, destructive confirm, test adaptation, and full validation passed |
| `local-skill-upload-description-limit-plan.md` | Client ZIP uploads now cap external descriptions at the existing 500-character summary limit before Skill/SkillVersion persistence; strict create/append regression tests reproduce the old 500 and pass after the fix, with backend/desktop/docs gates passing |
| `local-skill-upload-description-limit-tasks.md` | Completed checklist for diagnosing and fixing long-description upload failures, including archive preservation and debug-log cleanup |
| `desktop-sidebar-collapse-toggle-plan.md` | Desktop client manual sidebar collapse/expand toggle completed: ChevronsLeft/ChevronsRight button in brand area, hover-reveal, localStorage (`skilldrive:sidebarCollapsed`) persistence, `.app-shell--collapsed` icon-rail class, narrow-screen (`<=1099px`) button suppression; 3 new regression tests, 231 tests passing, build and docs gates clean |

## Notes

- Completed plans are retained for context and regression reference.
- If later work reopens the same topic, create a new active plan instead of editing history in place.
