# Completed Exec Plans

## Archived Plans

| File | Outcome |
|------|---------|
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

## Notes

- Completed plans are retained for context and regression reference.
- If later work reopens the same topic, create a new active plan instead of editing history in place.
