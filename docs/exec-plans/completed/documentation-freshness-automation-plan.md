# Documentation Freshness Automation Plan

Status: Completed
Updated: 2026-08-25

Design: `docs/design-docs/documentation-freshness-automation.md`
Tasks: `docs/exec-plans/completed/documentation-freshness-automation-tasks.md`

## Purpose / Big Picture

Extend repository document validation so stale plan/index/tracker relationships
are caught earlier and active execution documents stay easier to trust.

## Progress

- [x] Create design doc, plan, and task checklist.
- [x] Add validator tests for active plan/task relationships. ✅ 5 测试用例覆盖配对缺失的正反方向
- [x] Add tech-debt source link checks. ✅ 5 测试用例；修复 `user_state.py` 路径引用
- [x] Add active/completed index consistency checks.
- [x] Roll out new checks as warnings before hard errors if needed.
- [x] Add tests for completed plans marked as in-progress. ✅ 6 测试用例；现有 completed 计划无状态错位
- [x] Run docs gate and archive. ✅ ruff/pytest/validator 全绿，0 错误

## Decisions

- 2026-08-25: Index consistency is bidirectional. Forward (index references a
  missing file) stays ERROR; reverse (file in active/completed not registered in
  index.md) is WARN per the warning-first rollout in the design doc.
- 2026-08-25: Validator tests live in `tests/test_validate_agents_docs.py`
  (new file; no prior validator test coverage existed).
- 2026-08-25: Plan/task pairing check runs on both active and completed.
  Completed plans missing tasks files are flagged as WARN; fixing historical
  gaps (7 found) is deferred to a separate pass.
- 2026-08-25: Tech debt source links are resolved relative to the repo root
  (not relative to tech-debt-tracker.md). Only paths in table rows with
  directory separators are checked to avoid false positives from Review Notes
  and bare filenames in the Topic column.
- 2026-08-25: Completed plan status check only flags plans that have a Status
  line with a non-terminal value (Draft for Review, In Progress, etc.). Plans
  without any Status line are allowed (historical archive pattern). TERMINAL_STATUSES
  includes completed, archived, done, finished.

## Surprises & Discoveries

- 2026-08-25: The reverse check immediately surfaced two real issues: a stale
  `help-center-plan.md` leftover in `active/` (plan already archived in
  `completed/`; file deleted), and all nine `-tasks.md` sibling files missing
  from `active/index.md` (now registered in a Task Checklists section, matching
  the `completed/index.md` convention).
- 2026-08-25: Plan/task pairing check found 7 completed plans without
  companion tasks files (enum-catalog, error-architecture-refactor, frontend-i18n,
  help-center, profile-identity-settings-center, skills-api-boundary,
  user-status-followup). These are historical gaps; the check warns but does
  not error.
- 2026-08-25: Tech debt source link check found a broken reference:
  `user_state.py` (bare filename) instead of `backend/core/security/user_state.py`.
  Fixed in tech-debt-tracker.md. The design also revealed that Source column
  paths are repo-root-relative, not file-relative.
- 2026-08-25: Completed plan status check found zero status mismatches.
  7 completed plans have explicit `Status: Completed`; the rest have no
  Status line (pre-convention archive pattern, allowed).

## Key Files

- `scripts/validate_agents_docs.py`
- `docs/exec-plans/active/index.md`
- `docs/exec-plans/completed/index.md`
- `docs/exec-plans/tech-debt-tracker.md`

## Validation

```bash
python scripts/validate_agents_docs.py --level ERROR
uv run pytest tests/test_validate_agents_docs.py -v
```
