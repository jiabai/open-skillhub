# Merge desktop-client task-tracker into the ExecPlan system — Execution Plan

- Spec: `docs/product-specs/2026-08-28-merge-desktop-task-tracker-into-exec-plans.md`
- Status: Completed (2026-08-28)
- Scope: `desktop-client/`, root `AGENTS.md`, `scripts/validate_agents_docs.py`, `docs/EXECUTION_GATES.md`, `docs/design-docs/execution-gates-adoption.md`

## Outcome

All steps completed. `desktop-client/task-tracker.md` was retired; desktop task
state now lives in `desktop-client/docs/exec-plans/`. Validator passes with 0 errors.

## Context

`desktop-client/task-tracker.md` is a redundant parallel tracker. Its three
sections map cleanly onto the existing desktop ExecPlan tree:

- **In Progress** → `desktop-client/docs/exec-plans/active/index.md` (all four
  entries already appear there, incl. `2026-05-03-desktop-windows-packaging*`,
  `2026-05-03-macos-release-packaging*`, `2026-05-14-linux-cli-packaged-deployment*`,
  `2026-08-28-local-skill-frontmatter-description`).
- **Todo** → `desktop-client/docs/exec-plans/tech-debt-tracker.md` (the
  "persist distribution history" item is already DC-003; the second todo is checked/done).
- **Done** → `desktop-client/docs/exec-plans/completed/index.md` (every done item
  already has an archived plan there).

So the merge is primarily a *removal of the redundant file plus reference
cleanup* after confirming no unique content is lost.

## Files to change (order of work)

### Step 1 — Verify content coverage (read-only)
- Reconcile every checkbox line in `desktop-client/task-tracker.md` against the
  desktop `exec-plans/active/index.md`, `exec-plans/completed/index.md`, and
  `tech-debt-tracker.md`.
- Confirm no unique/unrepresented item exists. If one is found, port it to the
  appropriate active/completed plan or a new tech-debt entry.

### Step 2 — Remove the hard validator requirement
- Edit `scripts/validate_agents_docs.py`:
  - Remove the `validate_desktop_task_tracker()` function and its call.
  - Remove the `TASK_TRACKER_REQUIRED_HEADINGS` constant (or keep only if unused elsewhere).
  - Remove the "桌面客户端任务跟踪器检查" block and the example INFO line in the
    module docstring.
  - Ensure no dangling references.

### Step 3 — Repoint desktop guidance
- `desktop-client/AGENTS.md`: replace "Task tracker: `task-tracker.md`" with
  "ExecPlan tracker: `docs/exec-plans/index.md`"; update the Development Flow lines that
  say "Read `task-tracker.md`" and "Update `task-tracker.md`".
- `desktop-client/README.md`, `desktop-client/README-zh.md`: swap `task-tracker.md`
  entry for `docs/exec-plans/index.md` in the tracked-files list.
- `desktop-client/docs/ARCHITECTURE.md`, `desktop-client/docs/DESIGN.md`: replace
  `task-tracker.md` mentions with the ExecPlan tracker path.

### Step 4 — Repoint repo-level references
- root `AGENTS.md`: change the rule
  "`desktop-client/` keeps its own `desktop-client/task-tracker.md`; do not create
  a second parallel tracker inside that subproject" to instruct that desktop task
  state lives in `desktop-client/docs/exec-plans/`.
- `docs/design-docs/execution-gates-adoption.md`: update the claim that the
  validator checks `desktop-client/task-tracker.md`.
- `docs/EXECUTION_GATES.md`: update the "Do not mark task-tracker items as done"
  line to reference the ExecPlan tracker instead.

### Step 5 — Remove the file and sweep references
- Delete `desktop-client/task-tracker.md`.
- Grep the whole tree for `task-tracker`; resolve every remaining reference:
  - Completed/archived plans that merely *mention* `task-tracker.md` as a historical
    step may remain readable but should not be required to exist. Only repoint
    live "edit task-tracker" instructions.
  - Any live instructions in `desktop-client/docs/design-docs/*` or active plans
    that say "update/add entry to task-tracker.md" must be rewritten to point at
    the ExecPlan tree.

### Step 6 — Validate
- `python scripts/validate_agents_docs.py --level ERROR`
- `python scripts/validate_agents_docs.py` (INFO) — confirm no ERROR from the removed file
- Grep again for `task-tracker` to confirm no dangling required reference.
- Archive this plan to `desktop-client/docs/exec-plans/completed/` (or root `docs/exec-plans/completed/` per spec owner) and update indexes.

## Decision to track
- Whether the spec/plan should be archived under root `docs/exec-plans/completed/`
  or the desktop `desktop-client/docs/exec-plans/completed/` subtree. Because the
  change spans both trees, default to the root `docs/exec-plans/completed/` unless
  a desktop-only home is preferred.

## Residual risk
- Historical completed plans reference `task-tracker.md` as an artifact. After
  deletion these become stale mentions; acceptable if they read as history, but
  grep must confirm none are live required edits.