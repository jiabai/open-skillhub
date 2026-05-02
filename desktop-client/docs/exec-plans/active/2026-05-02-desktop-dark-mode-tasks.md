# Desktop Dark Mode Task Checklist

Status: active, implementation not started

## Documentation Gate

- [x] Review root `WORKFLOW.md`, root `docs/EXECUTION_GATES.md`, and
  `desktop-client/AGENTS.md`.
- [x] Review desktop architecture, design rules, task tracker, and current
  runtime config/IPC/theme surfaces.
- [x] Review frontend `ThemeProvider`, `ThemeToggle`, app shell placement, and
  dark CSS token strategy.
- [x] Add English product spec.
- [x] Add Chinese product spec.
- [x] Add technical design.
- [x] Add active ExecPlan.
- [x] Add implementation checklist.
- [x] Run documentation validation after all doc edits.

## Implementation Gate

- [ ] Add `AppTheme` and theme field to shared types.
- [ ] Write runtime config theme persistence tests.
- [ ] Implement runtime config theme default, validation, persistence, and
  `saveTheme`.
- [ ] Add `saveTheme` IPC/preload/renderer bridge contract.
- [ ] Wire Electron main-process `saveTheme` handler.
- [ ] Add renderer tests for initial dark class, toggle persistence, returned
  state reconciliation, and failure restoration.
- [ ] Add theme toggle component and header placement.
- [ ] Add English and Chinese theme toggle copy.
- [ ] Add dark CSS tokens and replace hardcoded light-only surfaces.
- [ ] Update durable architecture/design/runtime docs.

## Validation Gate

- [ ] `cd desktop-client && npm test`
- [ ] `cd desktop-client && npm run build`
- [ ] `python scripts/validate_agents_docs.py --level ERROR`
- [ ] `git diff --check`
- [ ] Move the ExecPlan and checklist to `docs/exec-plans/completed/` after
  implementation completion.
