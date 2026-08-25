#!/usr/bin/env python3
"""验证 SkillDrive 项目文档入口点和任务跟踪器的完整性。

此脚本用于检查项目文档结构是否符合规范，确保所有必需的文档文件存在、
链接有效、任务跟踪器格式正确。

验证内容：
1. 必需路径检查
   - 验证 AGENTS.md、docs/ARCHITECTURE.md、WORKFLOW.md、docs/EXECUTION_GATES.md 等核心文档是否存在
   - 验证各子项目（backend/frontend/desktop-client）的 AGENTS.md 是否存在
   - 验证 docs/ 目录下的设计文档、产品规格、执行计划索引是否存在

2. 约束机制检查
   - 验证根 AGENTS.md 是否包含「约束机制」章节
   - 验证模式（agents-only / linter+agents）和配置是否合法
   - 验证 linter+agents 模式下配置文件是否存在

3. 文档链接检查
   - 检查所有入口文件中的反引号代码块路径引用（`path/to/file.md`）
   - 验证引用的文档文件是否真实存在，防止死链

4. 执行计划索引检查
   - 验证 docs/exec-plans/active/index.md 和 completed/index.md 中的引用
   - 确保索引中列出的执行计划文件都存在
   - 反向一致性：目录中的计划文件必须注册在对应 index.md 中（未注册记 WARN）
   - Plan/task 配对检查：<slug>-plan.md 与 <slug>-tasks.md 必须成对出现（缺失配对记 WARN）
   - Tech debt 源链接检查：tech-debt-tracker.md 中 Source 列引用的文件必须存在（缺失记 ERROR）
   - Completed 计划状态检查：completed/ 下的 plan 若有 Status 行且非已完结状态（Completed/Archived）记 WARN

5. 桌面客户端任务跟踪器检查
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
    Path("docs/ARCHITECTURE.md"),
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

CONSTRAINT_SECTION = "约束机制"
CONSTRAINT_MODE_PATTERN = re.compile(r"模式[：:]\s*`([^`]+)`")
CONSTRAINT_CONFIG_PATTERN = re.compile(r"配置[：:]\s*`([^`]+)`")
VALID_CONSTRAINT_MODES = {"agents-only", "linter+agents"}


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


def validate_exec_plan_directory_consistency(index_path: Path) -> list[ValidationResult]:
    """检查计划目录中的文件是否都注册在对应 index.md 中（反向一致性）。

    索引引用缺失文件是 ERROR（见 validate_exec_plan_index）；
    目录中存在未注册文件按 warning-first 策略记 WARN。
    """
    results: list[ValidationResult] = []
    if not index_path.exists():
        return results

    directory = index_path.parent
    referenced = {
        rel
        for rel in BACKTICK_PATH_PATTERN.findall(index_path.read_text(encoding="utf-8"))
        if rel.endswith(".md") and "*" not in rel and "<" not in rel and ">" not in rel
    }

    for plan_file in sorted(directory.glob("*.md")):
        if plan_file.name == "index.md":
            continue
        if plan_file.name not in referenced:
            results.append(ValidationResult(
                plan_file,
                Severity.WARN,
                f"存在于 {directory.name}/ 但未注册在 index.md 中",
            ))
    return results


def validate_plan_task_pairing(directory: Path) -> list[ValidationResult]:
    """检查 active/completed 目录中的 plan 文件是否有配套 tasks 文件，反之亦然。

    命名约定：<slug>-plan.md 对应 <slug>-tasks.md。
    缺失配对按 warning-first 策略记 WARN。
    """
    results: list[ValidationResult] = []
    if not directory.is_dir():
        return results

    plan_files = {
        f.stem.removesuffix("-plan"): f
        for f in directory.glob("*-plan.md")
    }
    task_files = {
        f.stem.removesuffix("-tasks"): f
        for f in directory.glob("*-tasks.md")
    }

    for slug, plan_file in sorted(plan_files.items()):
        if slug not in task_files:
            results.append(ValidationResult(
                plan_file,
                Severity.WARN,
                f"Plan 缺少配套 tasks 文件: {slug}-tasks.md",
            ))

    for slug, task_file in sorted(task_files.items()):
        if slug not in plan_files:
            results.append(ValidationResult(
                task_file,
                Severity.WARN,
                f"Tasks 缺少配套 plan 文件: {slug}-plan.md",
            ))

    return results


def validate_tech_debt_source_links(path: Path) -> list[ValidationResult]:
    """检查 tech-debt-tracker.md 中 Source 列的路径引用是否指向存在的文件。

    Source 列中的路径是相对于仓库根目录的，而不是相对于 tech-debt-tracker.md
    本身。只扫描 Markdown 表格行中的反引号引用，避免误检 Review Notes 等叙述文本。
    """
    results: list[ValidationResult] = []
    if not path.exists():
        return results

    repo_root = ROOT
    text = path.read_text(encoding="utf-8")
    for line in text.splitlines():
        if "|" not in line:
            continue
        for rel in BACKTICK_PATH_PATTERN.findall(line):
            if "*" in rel or "<" in rel or ">" in rel:
                continue
            if "/" not in rel and "\\" not in rel:
                continue
            if not (rel.endswith(".md") or rel.endswith(".py") or rel.endswith(".ts") or rel.endswith(".tsx") or rel.endswith(".js") or rel.endswith(".json")):
                continue
            target = (repo_root / rel).resolve()
            if not target.exists():
                results.append(ValidationResult(path, Severity.ERROR, f"Tech debt source 引用不存在: {rel}"))
    return results


TERMINAL_STATUSES = {"completed", "archived", "done", "finished"}


def validate_completed_plan_status(directory: Path) -> list[ValidationResult]:
    """检查 completed 目录中的 plan 文件是否标记为已完结状态。

    历史计划可能没有 Status 行，这是允许的。只有当 Status 行存在且值不是
    已完结状态时才记 WARN。
    """
    results: list[ValidationResult] = []
    if not directory.is_dir():
        return results

    for plan_file in sorted(directory.glob("*-plan.md")):
        text = plan_file.read_text(encoding="utf-8")
        match = re.search(r"^Status:\s*(.+)", text, re.MULTILINE)
        if match is None:
            continue
        status_value = match.group(1).strip().lower()
        if status_value not in TERMINAL_STATUSES:
            results.append(ValidationResult(
                plan_file,
                Severity.WARN,
                f"已完成计划状态为 '{match.group(1).strip()}'，应为 Completed/Archived",
            ))
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


def validate_constraint_mechanism(root: Path) -> list[ValidationResult]:
    results: list[ValidationResult] = []
    agents_md = root / "AGENTS.md"

    if not agents_md.exists():
        return results

    content = agents_md.read_text(encoding="utf-8")
    lines = content.splitlines()

    in_section = False
    section_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped == f"## {CONSTRAINT_SECTION}":
            in_section = True
            continue
        if in_section and stripped.startswith("## "):
            break
        if in_section:
            section_lines.append(line)

    if not section_lines:
        results.append(ValidationResult(
            agents_md, Severity.ERROR,
            "缺少'约束机制'章节",
        ))
        return results

    mode: str | None = None
    config: str | None = None
    for line in section_lines:
        if mode is None:
            match = CONSTRAINT_MODE_PATTERN.search(line)
            if match:
                mode = match.group(1)
        if config is None:
            match = CONSTRAINT_CONFIG_PATTERN.search(line)
            if match:
                config = match.group(1)

    if mode is None:
        results.append(ValidationResult(agents_md, Severity.ERROR, "缺少'约束机制.模式'声明"))
    elif mode not in VALID_CONSTRAINT_MODES:
        results.append(ValidationResult(
            agents_md, Severity.ERROR,
            f"'约束机制.模式' 非法: {mode}（必须是 agents-only 或 linter+agents）",
        ))

    if config is None:
        results.append(ValidationResult(agents_md, Severity.ERROR, "缺少'约束机制.配置'声明"))
    elif mode == "agents-only":
        if config != "N/A":
            results.append(ValidationResult(
                agents_md, Severity.ERROR,
                "'约束机制.配置' 在 agents-only 模式下必须为 `N/A`",
            ))
    elif mode == "linter+agents":
        if config == "N/A":
            results.append(ValidationResult(
                agents_md, Severity.ERROR,
                "'约束机制.配置' 在 linter+agents 模式下必须为真实配置文件路径",
            ))
        else:
            resolved = (agents_md.parent / config).resolve()
            if not resolved.exists():
                results.append(ValidationResult(
                    resolved, Severity.ERROR,
                    f"约束配置文件不存在（在 '约束机制.配置' 中声明）: {config}",
                ))

    return results


def validate_project(root: Path) -> list[ValidationResult]:
    results: list[ValidationResult] = []
    results.extend(validate_required_paths(root))
    results.extend(validate_constraint_mechanism(root))

    for rel_path in ENTRYPOINT_FILES:
        results.extend(validate_backtick_links(root / rel_path))

    for rel in ("active", "completed"):
        index_path = root / "docs" / "exec-plans" / rel / "index.md"
        directory = index_path.parent
        results.extend(validate_exec_plan_index(index_path))
        results.extend(validate_exec_plan_directory_consistency(index_path))
        results.extend(validate_plan_task_pairing(directory))
        if rel == "completed":
            results.extend(validate_completed_plan_status(directory))
    results.extend(validate_desktop_task_tracker(root / "desktop-client" / "task-tracker.md"))
    results.extend(validate_tech_debt_source_links(root / "docs" / "exec-plans" / "tech-debt-tracker.md"))

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

    parser = argparse.ArgumentParser(description="Validate SkillDrive documentation entry points")
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
