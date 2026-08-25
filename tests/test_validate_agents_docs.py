"""scripts/validate_agents_docs.py 执行计划索引一致性检查的单元测试。"""

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from validate_agents_docs import (  # noqa: E402
    Severity,
    validate_completed_plan_status,
    validate_exec_plan_directory_consistency,
    validate_exec_plan_index,
    validate_plan_task_pairing,
    validate_tech_debt_source_links,
)


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_directory_consistency_warns_on_unregistered_plan(tmp_path: Path) -> None:
    """目录中存在未注册进 index.md 的计划文件时记 WARN（如过期残留）。"""
    index = tmp_path / "active" / "index.md"
    _write(index, "# Active\n\n| File | Focus |\n|------|-------|\n| `foo-plan.md` | Foo |\n")
    _write(tmp_path / "active" / "foo-plan.md", "# Foo")
    _write(tmp_path / "active" / "bar-plan.md", "# Bar")

    results = validate_exec_plan_directory_consistency(index)

    assert len(results) == 1
    assert results[0].severity is Severity.WARN
    assert results[0].path.name == "bar-plan.md"


def test_directory_consistency_passes_when_all_registered(tmp_path: Path) -> None:
    index = tmp_path / "active" / "index.md"
    _write(index, "| `foo-plan.md` | Foo |\n| `foo-tasks.md` | Foo tasks |\n")
    _write(tmp_path / "active" / "foo-plan.md", "# Foo")
    _write(tmp_path / "active" / "foo-tasks.md", "# Foo tasks")

    assert validate_exec_plan_directory_consistency(index) == []


def test_directory_consistency_ignores_index_itself(tmp_path: Path) -> None:
    index = tmp_path / "completed" / "index.md"
    _write(index, "# Completed\n")

    assert validate_exec_plan_directory_consistency(index) == []


def test_directory_consistency_missing_index_returns_empty(tmp_path: Path) -> None:
    assert validate_exec_plan_directory_consistency(tmp_path / "active" / "index.md") == []


def test_index_check_errors_on_missing_referenced_file(tmp_path: Path) -> None:
    """索引引用了不存在的文件时记 ERROR（正向死链检查）。"""
    index = tmp_path / "active" / "index.md"
    _write(index, "| `missing-plan.md` | Missing |\n")

    results = validate_exec_plan_index(index)

    assert len(results) == 1
    assert results[0].severity is Severity.ERROR
    assert "missing-plan.md" in results[0].message


# --- Plan/task pairing tests ---


def test_pairing_warns_when_plan_lacks_tasks(tmp_path: Path) -> None:
    """Plan 文件缺少配套 tasks 文件时记 WARN。"""
    d = tmp_path / "active"
    _write(d / "foo-plan.md", "# Foo plan")
    _write(d / "foo-tasks.md", "# Foo tasks")
    _write(d / "bar-plan.md", "# Bar plan")

    results = validate_plan_task_pairing(d)

    assert len(results) == 1
    assert results[0].severity is Severity.WARN
    assert results[0].path.name == "bar-plan.md"
    assert "bar-tasks.md" in results[0].message


def test_pairing_warns_when_tasks_lacks_plan(tmp_path: Path) -> None:
    """Tasks 文件缺少配套 plan 文件时记 WARN。"""
    d = tmp_path / "active"
    _write(d / "foo-plan.md", "# Foo plan")
    _write(d / "foo-tasks.md", "# Foo tasks")
    _write(d / "orphan-tasks.md", "# Orphan tasks")

    results = validate_plan_task_pairing(d)

    assert len(results) == 1
    assert results[0].severity is Severity.WARN
    assert results[0].path.name == "orphan-tasks.md"
    assert "orphan-plan.md" in results[0].message


def test_pairing_passes_when_all_paired(tmp_path: Path) -> None:
    d = tmp_path / "active"
    _write(d / "foo-plan.md", "# Foo")
    _write(d / "foo-tasks.md", "# Foo tasks")
    _write(d / "bar-plan.md", "# Bar")
    _write(d / "bar-tasks.md", "# Bar tasks")

    assert validate_plan_task_pairing(d) == []


def test_pairing_returns_empty_for_missing_directory(tmp_path: Path) -> None:
    assert validate_plan_task_pairing(tmp_path / "nonexistent") == []


def test_pairing_handles_mixed_files(tmp_path: Path) -> None:
    """只有 plan 或只有 tasks 的文件都应被检出。"""
    d = tmp_path / "active"
    _write(d / "paired-plan.md", "# Paired")
    _write(d / "paired-tasks.md", "# Paired tasks")
    _write(d / "only-plan-plan.md", "# Only plan")
    _write(d / "only-tasks-tasks.md", "# Only tasks")

    results = validate_plan_task_pairing(d)

    assert len(results) == 2
    paths = {r.path.name: r for r in results}
    assert paths["only-plan-plan.md"].severity is Severity.WARN
    assert paths["only-tasks-tasks.md"].severity is Severity.WARN


# --- Tech debt source link tests ---


def test_tech_debt_warns_on_missing_source(tmp_path: Path, monkeypatch) -> None:
    """Source 列引用不存在的文件时记 ERROR。"""
    # 将 ROOT 指向 tmp_path 以便控制文件存在性
    monkeypatch.setattr("validate_agents_docs.ROOT", tmp_path)

    tracker = tmp_path / "docs" / "exec-plans" / "tech-debt-tracker.md"
    _write(tracker, "| Topic | Status | Why | Source | Condition |\n|------|--------|-----|--------|-----------|\n| `foo` | Planned | Why | `docs/design-docs/missing.md` | Done |\n")

    results = validate_tech_debt_source_links(tracker)

    assert len(results) == 1
    assert results[0].severity is Severity.ERROR
    assert "docs/design-docs/missing.md" in results[0].message


def test_tech_debt_passes_when_source_exists(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("validate_agents_docs.ROOT", tmp_path)

    tracker = tmp_path / "docs" / "exec-plans" / "tech-debt-tracker.md"
    _write(tracker, "| Topic | Status | Why | Source | Condition |\n|------|--------|-----|--------|-----------|\n| `foo` | Planned | Why | `docs/design-docs/exists.md` | Done |\n")
    _write(tmp_path / "docs" / "design-docs" / "exists.md", "# Exists")

    assert validate_tech_debt_source_links(tracker) == []


def test_tech_debt_ignores_non_table_lines(tmp_path: Path, monkeypatch) -> None:
    """Review Notes 中的反引号引用（非表格行）不应被检查。"""
    monkeypatch.setattr("validate_agents_docs.ROOT", tmp_path)

    tracker = tmp_path / "docs" / "exec-plans" / "tech-debt-tracker.md"
    _write(tracker, "- Refined after `some-plan.md` completion.\n")

    assert validate_tech_debt_source_links(tracker) == []


def test_tech_debt_ignores_bare_filenames(tmp_path: Path, monkeypatch) -> None:
    """Topic 列中的纯文件名（无路径分隔符）不应被检查。"""
    monkeypatch.setattr("validate_agents_docs.ROOT", tmp_path)

    tracker = tmp_path / "docs" / "exec-plans" / "tech-debt-tracker.md"
    _write(tracker, "| `user_state.py` shim | Planned | Why | `docs/design-docs/plan.md` | Done |\n")
    _write(tmp_path / "docs" / "design-docs" / "plan.md", "# Plan")

    results = validate_tech_debt_source_links(tracker)

    assert len(results) == 0


def test_tech_debt_returns_empty_for_missing_file(tmp_path: Path) -> None:
    assert validate_tech_debt_source_links(tmp_path / "nonexistent.md") == []


# --- Completed plan status tests ---


def test_completed_status_warns_on_non_terminal(tmp_path: Path) -> None:
    """Completed 计划有 Status 行但不是已完结状态时记 WARN。"""
    d = tmp_path / "completed"
    _write(d / "foo-plan.md", "# Foo\n\nStatus: Draft for Review\n")

    results = validate_completed_plan_status(d)

    assert len(results) == 1
    assert results[0].severity is Severity.WARN
    assert "Draft for Review" in results[0].message


def test_completed_status_passes_on_completed(tmp_path: Path) -> None:
    d = tmp_path / "completed"
    _write(d / "foo-plan.md", "# Foo\n\nStatus: Completed\n")

    assert validate_completed_plan_status(d) == []


def test_completed_status_passes_on_archived(tmp_path: Path) -> None:
    d = tmp_path / "completed"
    _write(d / "foo-plan.md", "# Foo\n\nStatus: Archived\n")

    assert validate_completed_plan_status(d) == []


def test_completed_status_passes_when_no_status_line(tmp_path: Path) -> None:
    """历史计划没有 Status 行是允许的。"""
    d = tmp_path / "completed"
    _write(d / "foo-plan.md", "# Foo\n\n## Goal\nSome goal\n")

    assert validate_completed_plan_status(d) == []


def test_completed_status_ignores_tasks_files(tmp_path: Path) -> None:
    """只检查 plan 文件，tasks 文件不在范围内。"""
    d = tmp_path / "completed"
    _write(d / "foo-tasks.md", "# Foo tasks\n\nStatus: Draft for Review\n")

    assert validate_completed_plan_status(d) == []


def test_completed_status_returns_empty_for_missing_dir(tmp_path: Path) -> None:
    assert validate_completed_plan_status(tmp_path / "nonexistent") == []
