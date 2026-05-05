# Documentation Freshness Automation Plan

Status: Draft for Review
Updated: 2026-05-06

Design: `docs/design-docs/documentation-freshness-automation.md`
Tasks: `docs/exec-plans/active/documentation-freshness-automation-tasks.md`

## Purpose / Big Picture

Extend repository document validation so stale plan/index/tracker relationships
are caught earlier and active execution documents stay easier to trust.

## Progress

- [x] Create design doc, plan, and task checklist.
- [ ] Add validator tests for active plan/task relationships.
- [ ] Add tech-debt source link checks.
- [ ] Add active/completed index consistency checks.
- [ ] Roll out new checks as warnings before hard errors if needed.
- [ ] Run docs gate and archive.

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
