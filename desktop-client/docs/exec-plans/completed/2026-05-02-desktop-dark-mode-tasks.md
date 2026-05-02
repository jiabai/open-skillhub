# Desktop Dark Mode Task Checklist

Status: completed

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

- [x] Add `AppTheme` and theme field to shared types.
- [x] Write runtime config theme persistence tests.
- [x] Implement runtime config theme default, validation, persistence, and
  `saveTheme`.
- [x] Add `saveTheme` IPC/preload/renderer bridge contract.
- [x] Wire Electron main-process `saveTheme` handler.
- [x] Add renderer tests for initial dark class, toggle persistence, returned
  state reconciliation, and failure restoration.
- [x] Add theme toggle component and header placement.
- [x] Add English and Chinese theme toggle copy.
- [x] Add dark CSS tokens and replace hardcoded light-only surfaces.
- [x] Update durable architecture/design/runtime docs.

## Validation Gate

- [x] `cd desktop-client && npm test`
- [x] `cd desktop-client && npm run build`
- [x] `python scripts/validate_agents_docs.py --level ERROR`
- [x] `git diff --check`
- [x] Move the ExecPlan and checklist to `docs/exec-plans/completed/` after
  implementation completion.
