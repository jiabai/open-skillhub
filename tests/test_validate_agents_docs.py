"""scripts/validate_agents_docs.py 执行计划索引一致性检查的单元测试。"""

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from validate_agents_docs import (  # noqa: E402
    Severity,
    validate_exec_plan_directory_consistency,
    validate_exec_plan_index,
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
