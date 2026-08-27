# Completed Exec Plans

## Archived Plans

| File | Outcome |
|------|---------|
| [2026-08-27-responsive-review-workspace.md](2026-08-27-responsive-review-workspace.md) | Unified responsive Shell across Home, Updates, Local Skills, and Projects, with an Updates-only review action bar and renderer-only sequential multi-select distribution orchestration |
| [2026-08-26-local-skill-group-path-picker.md](2026-08-26-local-skill-group-path-picker.md) | Local Skills grouped cards now open single paths directly and require explicit path selection before opening same-name groups with multiple local directories |
| [local-skill-content-hash-compare.md](local-skill-content-hash-compare.md) | Local Skills inventory now falls back to backend-identical SHA-256 content-hash comparison when the semver comparison is not decisive, surfacing `update-available` for drifted local content (e.g. skills without a `version` field) |
| [local-skill-version-compare.md](local-skill-version-compare.md) | Local Skills inventory now compares local semver against remote semver, classifying local-newer rows as `update-available` with a warning badge and enabled upload button |
| [2026-05-14-architecture-deepening.md](2026-05-14-architecture-deepening.md) | Desktop-client now has shared Client Skill API and Skill Package Tree modules used by Electron, Linux CLI, Local Skills upload, and Project Skill import without changing public behavior |
| [2026-05-14-architecture-deepening-tasks.md](2026-05-14-architecture-deepening-tasks.md) | Completed TDD task checklist for the desktop-client architecture deepening refactor |
| [2026-05-13-linux-cli-distribution.md](2026-05-13-linux-cli-distribution.md) | Desktop-client now builds a separate `skilldrive-cli` Node CLI for local install and server-backed global/project skill sync, with XDG storage, dry-run planning, scoped CLI sync state, and v1 encrypted-download refusal |
| [2026-05-13-linux-cli-distribution-tasks.md](2026-05-13-linux-cli-distribution-tasks.md) | Completed TDD task checklist for Linux CLI skill distribution |
| [2026-05-13-hermes-categorized-skill-layout.md](2026-05-13-hermes-categorized-skill-layout.md) | Hermes Agent now uses target-level categorized skill layout metadata, with layout-aware detection, metadata reads, Local Skills inventory, distribution writes, and project scan/import support |
| [2026-05-13-hermes-categorized-skill-layout-tasks.md](2026-05-13-hermes-categorized-skill-layout-tasks.md) | Completed TDD task checklist for Hermes categorized skill layout support |
| [2026-05-07-project-skill-loading.md](2026-05-07-project-skill-loading.md) | Desktop-client Projects view now persists project records in `config/projects.json`, scans project/global skill rows, imports validated skill folders into catalog-defined project targets through typed IPC, and documents the new storage/security/runtime surface |
| [2026-05-07-project-skill-loading-tasks.md](2026-05-07-project-skill-loading-tasks.md) | Completed task checklist for the Project Skill Loading implementation |
| [2026-05-02-desktop-dark-mode.md](2026-05-02-desktop-dark-mode.md) | Desktop-client dark mode now defaults to dark, persists explicit light/dark theme config, exposes `saveTheme` through IPC, renders a one-click icon toggle, and uses frontend-aligned dark CSS tokens |
| [2026-05-02-desktop-dark-mode-tasks.md](2026-05-02-desktop-dark-mode-tasks.md) | Completed task checklist for the Desktop Dark Mode implementation |
| [2026-05-02-local-skills-management.md](2026-05-02-local-skills-management.md) | Desktop-client Local Skills inventory and explicit upload were implemented with row-key IPC, safe ZIP staging, Client API upload, refreshed inventory state, tests, and docs |
| [2026-05-02-local-skills-management-tasks.md](2026-05-02-local-skills-management-tasks.md) | Completed task checklist for the Local Skills Management implementation |
| [2026-05-04-agent-path-configuration.md](2026-05-04-agent-path-configuration.md) | Agent skill path overrides now use validated `config/agent-paths.json`, with typed IPC, a Settings entry point, detection merge support, and environment-variable path override removal |
| [2026-05-04-agent-path-configuration-tasks.md](2026-05-04-agent-path-configuration-tasks.md) | Completed task checklist for the agent path configuration implementation |
| [2026-05-04-upload-button-label-simplification.md](2026-05-04-upload-button-label-simplification.md) | Upload button label in Local Skills view simplified to show only "Upload"/"上传" without the skill name; i18n type changed from function to plain string |
| [2026-05-04-upload-button-label-simplification-tasks.md](2026-05-04-upload-button-label-simplification-tasks.md) | Completed task checklist for the upload button label simplification |
| [2026-05-01-sort-agents-by-install-status.md](2026-05-01-sort-agents-by-install-status.md) | Agent list in Settings drawer now shows installed agents first, then missing agents, for better user experience |
| [2026-05-01-encrypted-package-decryptor.md](2026-05-01-encrypted-package-decryptor.md) | Desktop-client encrypted skill package downloads now decrypt in the Electron main process when operators provide the backend download decryption secret through `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET`, with fail-closed behavior and regression coverage |
| [2026-05-01-fix-dialog-actions-footer.md](2026-05-01-fix-dialog-actions-footer.md) | Desktop-client distribution confirmation dialog actions now render in a fixed footer outside the scrollable dialog body, with regression coverage for footer placement |
| [2026-04-30-skill-name-directory-consistency.md](2026-04-30-skill-name-directory-consistency.md) | Desktop-client skill install directories and pre-distribution metadata checks now use SKILL names as the local directory key while keeping `remoteSkillId` as the API/state identity |
| [2026-04-27-agent-detection-and-distribution.md](2026-04-27-agent-detection-and-distribution.md) | Desktop-client agent detection and targeted distribution were implemented for 20 SKILL-capable assistants, including shared target dedupe, same-version reconcile, IPC, renderer UI, tests, and docs |
| [2026-04-27-agent-detection-and-distribution-tasks.md](2026-04-27-agent-detection-and-distribution-tasks.md) | Completed task checklist for the agent detection and targeted distribution implementation |
| [2026-04-27-package-artifact-cleanup.md](2026-04-27-package-artifact-cleanup.md) | Desktop-client package artifact cleanup ownership was implemented across package-service, runtime download staging, tests, and docs |
| [2026-04-26-pre-distribution-skill-check.md](2026-04-26-pre-distribution-skill-check.md) | Desktop-client read-only pre-distribution target checks were implemented across adapters, core service, IPC, renderer UI, tests, and docs |
| [2026-04-24-desktop-client-i18n.md](2026-04-24-desktop-client-i18n.md) | Desktop-client locale persistence, renderer translation, and locale-aware timestamps were implemented |
| [2026-04-24-desktop-client-i18n-task-plan.md](2026-04-24-desktop-client-i18n-task-plan.md) | Historical phase checklist for the desktop-client i18n work |
| [2026-04-23-desktop-client-ui-redesign.md](2026-04-23-desktop-client-ui-redesign.md) | Desktop UI was redesigned around Home, Updates, and a Settings drawer with local design tokens |
| [2026-04-23-api-token-config.md](2026-04-23-api-token-config.md) | Desktop API token configuration UI, IPC, runtime reload, and validation were implemented |
| [2026-04-17-operationalize-runtime-bootstrap.md](2026-04-17-operationalize-runtime-bootstrap.md) | Desktop runtime launch and API token bootstrap were operationalized |
| [2026-04-17-normalize-desktop-client-doc-system.md](2026-04-17-normalize-desktop-client-doc-system.md) | Desktop-client docs were normalized into the local canonical docs tree |

## Notes

- Completed plans are retained for context and regression reference.
- If later work reopens the same topic, create a new active plan instead of
  editing history in place.
