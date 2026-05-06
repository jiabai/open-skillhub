# Execution Gates

## Purpose

This document defines the completion gates for SkillDrive work. `WORKFLOW.md`
defines how work moves from idea to implementation; this file defines what must
be true before a task can be called done.

The intent is not to force every small change through every possible command.
The intent is to make validation explicit, proportional to risk, and visible in
the final handoff.

## Gate Levels

### Hard Gates

Hard gates must pass before work is marked complete. If a hard gate cannot be
run, the task is not complete unless the owner explicitly accepts the residual
risk.

- The affected code path has been inspected before editing.
- The narrowest meaningful tests or checks for the changed area pass.
- Documentation structure validation passes:

  ```bash
  python scripts/validate_agents_docs.py --level ERROR
  ```

- Any touched active ExecPlan has current Progress, Decisions, and validation
  notes.
- Architecture, security, process, runtime contract, or operational behavior
  changes are reflected in the matching durable docs.

### Soft Gates

Soft gates should be run when they are relevant, but they are not automatic
blockers until the project has stable tooling and thresholds for them.

- Broader regression suites beyond the affected area.
- Manual runtime checks.
- Security scans such as `pip-audit` or `npm audit`.
- Coverage reports.

When a relevant soft gate is skipped, record the reason and remaining risk in the
handoff or active ExecPlan.

### Future Automation

The project may later add `scripts/check_execution_gates.py` to orchestrate these
checks by area. Until that exists, use the commands in this document directly.
Do not describe coverage or security scanning as required gates until the tools,
thresholds, and CI behavior are defined.

## Definition Of Done

A task is done only when all of the following are true:

1. The requested behavior is implemented, fixed, or explicitly documented as out
   of scope.
2. The hard gates for every affected area pass.
3. Relevant specs, design docs, references, AGENTS maps, or ExecPlans are updated
   when behavior or process changed.
4. New technical debt is recorded in the active plan or
   `docs/exec-plans/tech-debt-tracker.md`.
5. The final handoff lists validations that passed, validations that were not
   run, and any residual risk.

## Area-Specific Gates

Run the smallest meaningful validation first, then expand when the change touches
shared behavior, contracts, security, persistence, or user-facing workflows.

### Backend

Applies to `backend/`, backend API contracts, migrations, repositories, services,
and `tests/`.

Default hard gates:

```bash
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```

For narrow bug fixes, start with the focused pytest target. Before closing, either
run the full default backend gates or record why a broader command was not run.

### Frontend Console

Applies to `frontend/`.

Default hard gates:

```bash
cd frontend && npm run lint
cd frontend && npm test
```

Also run this when the change affects routing, build behavior, Next.js
configuration, runtime configuration, or shared frontend contracts:

```bash
cd frontend && npm run build
```

### Desktop Client

Applies to `desktop-client/`.

Default hard gates:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
```

`npm run build` already includes Electron typechecking. During local iteration,
this narrower command is useful:

```bash
cd desktop-client && npm run typecheck:electron
```

### Documentation

Applies to `AGENTS.md`, `WORKFLOW.md`, `docs/`, `desktop-client/docs/`, product
specs, design docs, references, and ExecPlans.

Default hard gate:

```bash
python scripts/validate_agents_docs.py --level ERROR
```

If a document describes implemented behavior, inspect the corresponding code path
before claiming the document reflects reality.

### Cross-Area Changes

When a task touches more than one area, run the gates for each affected area.
Cross-area contract changes should update the relevant product spec, architecture
doc, reference doc, or active ExecPlan.

## Lightweight Path

The lightweight path in `WORKFLOW.md` remains available for low-risk work.

Lightweight work may skip:

- New product specs.
- New ExecPlans.
- Formal review pauses.
- Broad regression suites when the change is clearly isolated.

Lightweight work may not skip:

- Relevant focused validation.
- Documentation structure validation for docs/process changes.
- A clear final handoff that states what was checked.

Examples:

- A broken documentation link fix only needs the docs validator.
- A small desktop component fix should run the relevant desktop tests and, if the
  build surface is touched, the desktop build.
- A backend route behavior change should not use the lightweight path if it
  affects auth, persistence, or API contracts.

## Failure Handling

If a hard gate fails:

- Keep the task in progress.
- Fix the issue or record the blocker in the active ExecPlan.
- Do not move an active plan to completed.
- Do not mark task-tracker items as done.

If a hard gate cannot be run:

- State the command that was skipped.
- State why it could not be run.
- State the residual risk.
- Prefer running a narrower related validation instead of doing nothing.

## Reporting Format

Final handoffs should include a concise validation note:

```text
Validation:
- Passed: <command or check>
- Not run: <command or check> because <reason>
- Residual risk: <risk, or none>
```

For tiny documentation-only changes, one sentence is enough as long as the
validator result is clear.
