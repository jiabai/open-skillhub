#!/usr/bin/env python3
"""验证 Open SkillHub 项目文档入口点和任务跟踪器的完整性。

此脚本用于检查项目文档结构是否符合规范，确保所有必需的文档文件存在、
链接有效、任务跟踪器格式正确。

验证内容：
1. 必需路径检查
   - 验证 AGENTS.md、ARCHITECTURE.md、WORKFLOW.md、docs/EXECUTION_GATES.md 等核心文档是否存在
   - 验证各子项目（backend/frontend/desktop-client）的 AGENTS.md 是否存在
   - 验证 docs/ 目录下的设计文档、产品规格、执行计划索引是否存在

2. 文档链接检查
   - 检查所有入口文件中的反引号代码块路径引用（`path/to/file.md`）
   - 验证引用的文档文件是否真实存在，防止死链

3. 执行计划索引检查
   - 验证 docs/exec-plans/active/index.md 和 completed/index.md 中的引用
   - 确保索引中列出的执行计划文件都存在

4. 桌面客户端任务跟踪器检查
   - 验证 desktop-client/task-tracker.md 是否存在
   - 检查是否包含标准区段：In Progress、Todo、Done
   - 检查是否使用 checkbox 格式（- [ ] 或 - [x]）
   - 检查每个任务是否包含验证条件标记（✅）
   - 统计待办和已完成任务数量

严重级别：
- ERROR: 必须修复的问题（文件缺失、死链、格式错误）
- WARN: 建议修复的警告
- INFO: 信息性提示（如任务统计）

用法：
  python scripts/validate_agents_docs.py                    # 验证并显示所有级别
  python scripts/validate_agents_docs.py --level ERROR      # 仅显示错误
  python scripts/validate_agents_docs.py --level WARN       # 显示错误和警告
  python scripts/validate_agents_docs.py --level INFO       # 显示所有信息（默认）
  python scripts/validate_agents_docs.py --project /path    # 指定项目根目录

输出示例：
  [ERROR] docs/missing-file.md: 必需路径不存在
  [ERROR] AGENTS.md: 文档死链: ./nonexistent.md
  [INFO] desktop-client/task-tracker.md: 5 项待办, 10 项已完成
  
  验证完成: 2 个错误, 0 个警告

集成：
  建议在 CI/CD 流程中运行此脚本，确保文档质量：
  python scripts/validate_agents_docs.py --level ERROR
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class Severity(Enum):
    ERROR = "ERROR"
    WARN = "WARN"
    INFO = "INFO"


@dataclass
class ValidationResult:
    path: Path
    severity: Severity
    message: str

    def __str__(self) -> str:
        rel_path = self.path.relative_to(ROOT) if self.path.is_relative_to(ROOT) else self.path
        return f"[{self.severity.value}] {rel_path}: {self.message}"


BACKTICK_PATH_PATTERN = re.compile(r"`([^`]+)`")
CHECKBOX_PATTERN = re.compile(r"^- \[[ x]\]\s+", re.MULTILINE)
TASK_VALIDATION_MARKER = "✅"

ROOT_REQUIRED_PATHS = [
    Path("AGENTS.md"),
    Path("ARCHITECTURE.md"),
    Path("WORKFLOW.md"),
    Path("docs/EXECUTION_GATES.md"),
    Path("docs/DESIGN.md"),
    Path("docs/SECURITY.md"),
    Path("docs/design-docs/index.md"),
    Path("docs/product-specs/index.md"),
    Path("docs/exec-plans/active/index.md"),
    Path("docs/exec-plans/completed/index.md"),
    Path("docs/exec-plans/tech-debt-tracker.md"),
    Path("backend/AGENTS.md"),
    Path("frontend/AGENTS.md"),
    Path("desktop-client/AGENTS.md"),
]

ENTRYPOINT_FILES = [
    Path("AGENTS.md"),
    Path("backend/AGENTS.md"),
    Path("frontend/AGENTS.md"),
    Path("desktop-client/AGENTS.md"),
    Path("CLAUDE.md"),
]

TASK_TRACKER_REQUIRED_HEADINGS = ["In Progress", "Todo", "Done"]


def validate_required_paths(root: Path) -> list[ValidationResult]:
    results: list[ValidationResult] = []
    for rel_path in ROOT_REQUIRED_PATHS:
        path = root / rel_path
        if not path.exists():
            results.append(ValidationResult(path, Severity.ERROR, "必需路径不存在"))
    return results


def validate_backtick_links(path: Path) -> list[ValidationResult]:
    results: list[ValidationResult] = []
    if not path.exists():
        return results

    text = path.read_text(encoding="utf-8")
    for rel in BACKTICK_PATH_PATTERN.findall(text):
        if not rel.endswith(".md"):
            continue
        if "*" in rel or "<" in rel or ">" in rel:
            continue
        target = (path.parent / rel).resolve()
        if not target.exists():
            results.append(ValidationResult(path, Severity.ERROR, f"文档死链: {rel}"))
    return results


def validate_exec_plan_index(path: Path) -> list[ValidationResult]:
    results: list[ValidationResult] = []
    if not path.exists():
        return results

    text = path.read_text(encoding="utf-8")
    for rel in BACKTICK_PATH_PATTERN.findall(text):
        if not rel.endswith(".md"):
            continue
        if "*" in rel or "<" in rel or ">" in rel:
            continue
        target = (path.parent / rel).resolve()
        if not target.exists():
            results.append(ValidationResult(path, Severity.ERROR, f"索引引用不存在: {rel}"))
    return results


def validate_desktop_task_tracker(path: Path) -> list[ValidationResult]:
    results: list[ValidationResult] = []
    if not path.exists():
        results.append(ValidationResult(path, Severity.ERROR, "desktop-client 任务跟踪文件不存在"))
        return results

    text = path.read_text(encoding="utf-8")
    headings = re.findall(r"^##\s+(.+)$", text, re.MULTILINE)
    missing_headings = [heading for heading in TASK_TRACKER_REQUIRED_HEADINGS if heading not in headings]
    if missing_headings:
        results.append(ValidationResult(path, Severity.ERROR, f"缺少标准区段: {', '.join(missing_headings)}"))

    task_lines = [line for line in text.splitlines() if CHECKBOX_PATTERN.match(line)]
    if not task_lines:
        results.append(ValidationResult(path, Severity.ERROR, "没有使用 checkbox 格式"))
    else:
        missing_validation = [idx + 1 for idx, line in enumerate(text.splitlines()) if CHECKBOX_PATTERN.match(line) and TASK_VALIDATION_MARKER not in line]
        if missing_validation:
            joined = ", ".join(f"第{line_no}行" for line_no in missing_validation)
            results.append(ValidationResult(path, Severity.ERROR, f"任务缺少验证条件（缺少 `✅`）: {joined}"))

    pending = len(re.findall(r"^- \[ \]\s+", text, re.MULTILINE))
    completed = len(re.findall(r"^- \[x\]\s+", text, re.MULTILINE))
    results.append(ValidationResult(path, Severity.INFO, f"{pending} 项待办, {completed} 项已完成"))
    return results


def validate_project(root: Path) -> list[ValidationResult]:
    results: list[ValidationResult] = []
    results.extend(validate_required_paths(root))

    for rel_path in ENTRYPOINT_FILES:
        results.extend(validate_backtick_links(root / rel_path))

    results.extend(validate_exec_plan_index(root / "docs" / "exec-plans" / "active" / "index.md"))
    results.extend(validate_exec_plan_index(root / "docs" / "exec-plans" / "completed" / "index.md"))
    results.extend(validate_desktop_task_tracker(root / "desktop-client" / "task-tracker.md"))

    return results


def filter_results(results: list[ValidationResult], min_level: Severity) -> list[ValidationResult]:
    order = [Severity.INFO, Severity.WARN, Severity.ERROR]
    allowed = order[order.index(min_level):]
    return [result for result in results if result.severity in allowed]


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(errors="backslashreplace")

    parser = argparse.ArgumentParser(description="Validate Open SkillHub documentation entry points")
    parser.add_argument("--project", type=Path, default=None, help="Project root (default: script parent)")
    parser.add_argument("--level", choices=["ERROR", "WARN", "INFO"], default="INFO")
    args = parser.parse_args()

    project_root = args.project or ROOT
    if not project_root.exists():
        print(f"[ERROR] Project root not found: {project_root}")
        return 1

    results = validate_project(project_root)
    filtered = filter_results(results, Severity(args.level))
    severity_order = [Severity.ERROR, Severity.WARN, Severity.INFO]
    filtered.sort(key=lambda item: severity_order.index(item.severity))

    for result in filtered:
        print(result)

    error_count = sum(1 for result in results if result.severity == Severity.ERROR)
    warn_count = sum(1 for result in results if result.severity == Severity.WARN)
    print(f"\n验证完成: {error_count} 个错误, {warn_count} 个警告")
    return 0 if error_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
