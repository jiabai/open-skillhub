# Documentation Freshness Automation Tasks

Status: Draft for Review
Updated: 2026-08-25

- [x] Create executable documentation package.
- [x] Inspect existing `scripts/validate_agents_docs.py` test coverage. ✅ 无既有测试；新建 `tests/test_validate_agents_docs.py`
- [ ] Add tests for missing active plan/task links.
- [ ] Add tests for tech-debt source links pointing at missing files.
- [ ] Add tests for completed plans marked as in-progress.
- [x] Implement validator helpers. ✅ `validate_exec_plan_directory_consistency`（active/completed 目录反向一致性）
- [x] Decide warning vs error behavior for each new check. ✅ 反向未注册记 WARN（warning-first）；正向死链维持 ERROR
- [x] Run validator tests and docs gate. ✅ `pytest tests/test_validate_agents_docs.py` 5 passed；validator INFO 级 0 错误 0 警告
- [ ] Update `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Archive plan and tasks.
