# Merge desktop-client task-tracker into ExecPlan — Task Checklist

- Plan: `docs/exec-plans/active/2026-08-28-merge-desktop-task-tracker-into-exec-plans-plan.md`
- Spec: `docs/product-specs/2026-08-28-merge-desktop-task-tracker-into-exec-plans.md`
- Status: complete (2026-08-28)

## Tasks

- [x] Verify every `desktop-client/task-tracker.md` item is represented in the
  desktop ExecPlan tree (In Progress → active index; Todo → tech-debt DC-003;
  Done → completed index).
- [x] `scripts/validate_agents_docs.py`: remove `validate_desktop_task_tracker()`,
  its call, `TASK_TRACKER_REQUIRED_HEADINGS`, `CHECKBOX_PATTERN`,
  `TASK_VALIDATION_MARKER`, and the docstring/example references.
- [x] Repoint `desktop-client/AGENTS.md`, `README.md`, `README-zh.md`,
  `docs/ARCHITECTURE.md`, `docs/DESIGN.md` to `docs/exec-plans/index.md`.
- [x] Repoint root `AGENTS.md` rule, `docs/EXECUTION_GATES.md`,
  `docs/design-docs/execution-gates-adoption.md`.
- [x] Update live file-spec tables in the three active packaging plans
  (`2026-05-03-desktop-windows-packaging.md`, `2026-05-03-macos-release-packaging.md`,
  `2026-05-14-linux-cli-packaged-deployment.md`).
- [x] Delete `desktop-client/task-tracker.md`.
- [x] Keep historical references in completed plans and design-docs readable.
- [x] Validate: `python scripts/validate_agents_docs.py --level ERROR` passes.
- [ ] Archive this plan to `docs/exec-plans/completed/` and update indexes.

## Validation

- `python scripts/validate_agents_docs.py` — no ERROR (only pre-existing model WARNs).
- Grep confirms remaining `task-tracker` mentions are archival only (no live
  "edit task-tracker" instructions).