# Local Skill Upload Description Limit Tasks

Status: Completed (2026-08-26)
Updated: 2026-08-26

- [x] Read workflow, architecture, security, desktop, and backend guidance.
- [x] Trace the actual upload path and inspect the real failing package.
- [x] Record ranked hypotheses and root-cause evidence.
- [x] Update spec/design and create the plan/checklist.
- [x] Obtain explicit user approval before code changes.
- [x] Add create-mode strict-description regression test and observe red.
- [x] Add append-mode strict-description regression test and observe red.
- [x] Add shared description limit/normalizer.
- [x] Apply normalization before Skill and SkillVersion persistence.
- [x] Verify archived/extracted `SKILL.md` retains the full description.
- [x] Remove all `[DEBUG-list]` / `[DEBUG-upload]` instrumentation.
- [x] Run focused backend upload tests.
- [x] Run full backend, desktop, and documentation gates.
- [x] Update the desktop task tracker and archive plan/tasks.

Validation: 688 backend tests, full Ruff, backend mypy, desktop Vitest, desktop build,
documentation validation (0 errors), and `git diff --check` passed on 2026-08-26.
