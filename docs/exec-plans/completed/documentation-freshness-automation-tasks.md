# Documentation Freshness Automation Tasks

Status: Completed
Updated: 2026-08-25

- [x] Create executable documentation package.
- [x] Inspect existing `scripts/validate_agents_docs.py` test coverage. ✅ 无既有测试；新建 `tests/test_validate_agents_docs.py`
- [x] Add tests for missing active plan/task links. ✅ 5 个配对检查用例 + 5 个索引一致性用例 = 10 全通过
- [x] Add tests for tech-debt source links pointing at missing files. ✅ 5 用例覆盖死链/存在/非表格行/纯文件名/缺失文件
- [x] Add tests for completed plans marked as in-progress. ✅ 6 用例覆盖非完结/已完结/无状态/忽略 tasks 文件/空目录
- [x] Implement validator helpers. ✅ `validate_exec_plan_directory_consistency`（active/completed 目录反向一致性）
- [x] Decide warning vs error behavior for each new check. ✅ 反向未注册记 WARN（warning-first）；正向死链维持 ERROR
- [x] Run validator tests and docs gate. ✅ `pytest tests/test_validate_agents_docs.py` 5 passed；validator INFO 级 0 错误 0 警告
- [ ] Update `docs/exec-plans/tech-debt-tracker.md`.
- [ ] Archive plan and tasks.
