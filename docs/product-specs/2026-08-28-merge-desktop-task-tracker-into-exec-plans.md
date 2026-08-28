# Merging desktop-client task-tracker into the ExecPlan system

- Date: 2026-08-28
- Status: Draft (pending review)
- Scope: Shared docs/process change across `desktop-client/`, root `AGENTS.md`, validator script, `docs/EXECUTION_GATES.md`
- Related plan: `docs/exec-plans/active/2026-08-28-merge-desktop-task-tracker-into-exec-plans-plan.md`

## User-visible goal

The current task state for `desktop-client` is tracked in **two parallel places**,
contradicting the repo rule "desktop-client keeps its own task-tracker.md; do not
create a second parallel tracker inside that subproject":

1. `desktop-client/task-tracker.md` (flat, hand-maintained In Progress / Todo / Done)
2. `desktop-client/docs/exec-plans/{active,completed}/index.md` plus the plan/task
   files and `desktop-client/docs/exec-plans/tech-debt-tracker.md`

The goal is to make the ExecPlan system the single source of truth for desktop
task state, retire the redundant `task-tracker.md`, and update every reference so
the repository remains consistent and the validator passes cleanly.

## Scope and non-goals

In scope:
- Verify every current item in `task-tracker.md` (In Progress / Todo / Done)
  already has a corresponding record in `desktop-client/docs/exec-plans/` or
  `tech-debt-tracker.md`. Any item that is NOT already represented must be ported
  into the appropriate active/completed plan or tech-debt entry first.
- Migrate the tracking responsibility from `task-tracker.md` to
  `desktop-client/docs/exec-plans/active/index.md`,
  `completed/index.md`, and `tech-debt-tracker.md`.
- Delete `desktop-client/task-tracker.md`.
- Update every file that references `task-tracker.md`:
  - `desktop-client/AGENTS.md` (Quick Entry + Development Flow + update notes)
  - root `AGENTS.md` (rule "desktop-client keeps its own task-tracker.md")
  - `desktop-client/README.md`, `desktop-client/README-zh.md`
  - `desktop-client/docs/ARCHITECTURE.md`, `desktop-client/docs/DESIGN.md`
  - `docs/design-docs/execution-gates-adoption.md`
  - `docs/EXECUTION_GATES.md`
  - `scripts/validate_agents_docs.py` (currently REQUIRES the file to exist)
  - Any active/completed plans or design-docs that list `task-tracker.md` as a
    step or location; leave historical/completed plans readable but repoint only
    if the reference is a live "edit task-tracker" instruction rather than a
    historical record.
- Search the whole tree for remaining `task-tracker.md` references and resolve them.

Non-goals:
- Do NOT change how the ExecPlan system itself works.
- Do NOT retitle/reformat the existing plan/task/index files.
- Do NOT alter backend or frontend tracking (root `docs/exec-plans/` is backend/frontend scope and is already the single tracker there).

## Affected surfaces

| Surface | Change |
|---------|--------|
| `desktop-client/task-tracker.md` | Deleted after content verified/ported |
| `desktop-client/AGENTS.md` | Point task tracking to `docs/exec-plans/index.md` |
| root `AGENTS.md` | Remove/replace the `task-tracker.md` rule with ExecPlan guidance |
| `desktop-client/README.md`, `README-zh.md` | Update the tracked-files list |
| `desktop-client/docs/ARCHITECTURE.md`, `docs/DESIGN.md` | Replace `task-tracker.md` references with ExecPlan tracker |
| `docs/design-docs/execution-gates-adoption.md` | Update the "validator checks task-tracker.md" claim |
| `docs/EXECUTION_GATES.md` | Update failure-handling note that mentions task-tracker |
| `scripts/validate_agents_docs.py` | Remove the hard requirement on `desktop-client/task-tracker.md` (and its validation); desktop tracking now validated via existing ExecPlan index checks |
| `desktop-client/docs/exec-plans/*` (active/completed/tech-debt) | Port any item not already represented |

## Acceptance criteria

- [x standing] Every item from `task-tracker.md` is represented in the desktop
  ExecPlan tree (`active/`, `completed/`, `tech-debt-tracker.md`).
- `desktop-client/task-tracker.md` no longer exists.
- No file in the repo still references a required `desktop-client/task-tracker.md`.
- `desktop-client/AGENTS.md` points to `docs/exec-plans/index.md` as the desktop task tracker.
- root `AGENTS.md` no longer instructs agents to maintain `desktop-client/task-tracker.md`.
- `scripts/validate_agents_docs.py` no longer errors when the file is absent, and still passes for the desktop ExecPlan indexes.
- Validator gates pass: `python scripts/validate_agents_docs.py --level ERROR` (no errors).