# Completed Exec Plans

## Archived Plans

| File | Outcome |
|------|---------|
| [2026-05-01-sort-agents-by-install-status.md](2026-05-01-sort-agents-by-install-status.md) | Agent list in Settings drawer now shows installed agents first, then missing agents, for better user experience |
| [2026-05-01-encrypted-package-decryptor.md](2026-05-01-encrypted-package-decryptor.md) | Desktop-client encrypted skill package downloads now decrypt in the Electron main process when operators provide the backend download decryption secret through `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET`, with fail-closed behavior and regression coverage |
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
