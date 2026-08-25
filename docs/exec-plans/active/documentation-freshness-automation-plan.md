# Documentation Freshness Automation Plan

Status: Draft for Review
Updated: 2026-08-25

Design: `docs/design-docs/documentation-freshness-automation.md`
Tasks: `docs/exec-plans/active/documentation-freshness-automation-tasks.md`

## Purpose / Big Picture

Extend repository document validation so stale plan/index/tracker relationships
are caught earlier and active execution documents stay easier to trust.

## Progress

- [x] Create design doc, plan, and task checklist.
- [ ] Add validator tests for active plan/task relationships.
- [ ] Add tech-debt source link checks.
- [x] Add active/completed index consistency checks.
- [x] Roll out new checks as warnings before hard errors if needed.
- [ ] Run docs gate and archive.

## Decisions

- 2026-08-25: Index consistency is bidirectional. Forward (index references a
  missing file) stays ERROR; reverse (file in active/completed not registered in
  index.md) is WARN per the warning-first rollout in the design doc.
- 2026-08-25: Validator tests live in `tests/test_validate_agents_docs.py`
  (new file; no prior validator test coverage existed).

## Surprises & Discoveries

- 2026-08-25: The reverse check immediately surfaced two real issues: a stale
  `help-center-plan.md` leftover in `active/` (plan already archived in
  `completed/`; file deleted), and all nine `-tasks.md` sibling files missing
  from `active/index.md` (now registered in a Task Checklists section, matching
  the `completed/index.md` convention).

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
