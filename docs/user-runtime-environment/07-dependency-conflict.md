---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 依赖冲突处理

### 冲突检测逻辑

```python
def detect_dependency_conflicts(
    installed: dict[str, str],
    required: list[str]
) -> list[dict]:
    """
    检测依赖冲突

    Args:
        installed: 已安装依赖 {"package": "version"}
                   注意：包名建议统一使用小写格式存储
        required: 需要安装的依赖 ["package>=version", ...]

    Returns:
        冲突列表 [{"package": str, "installed_version": str,
                  "required_version": str, "conflict_type": str}]
    """
    conflicts = []

    # 构建小写化的已安装依赖映射，确保大小写不敏感匹配
    installed_lower = {k.lower(): v for k, v in installed.items()}

    for req in required:
        pkg_name, version_spec = parse_requirement(req)
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower in installed_lower:
            installed_version = installed_lower[pkg_name_lower]

            # 检查版本是否满足要求
            if not version_satisfies(installed_version, version_spec):
                conflicts.append({
                    "package": pkg_name,
                    "installed_version": installed_version,
                    "required_version": version_spec,
                    "conflict_type": "version_mismatch"
                })

    return conflicts
```

### 升级影响预检

在用户确认「允许安装」之前，系统应模拟升级后的依赖状态，检查该用户所有其他 Skill 的依赖声明是否仍然满足。这样可以提前告知用户升级可能带来的影响，避免盲目决策。

```python
from packaging.requirements import InvalidRequirement, Requirement
from packaging.version import Version
from packaging.specifiers import SpecifierSet


def _pick_simulated_version(
    spec_set: SpecifierSet,
    current: Version | None,
) -> Version | None:
    """
    根据版本约束集合，选择一个模拟安装版本。

    策略：
    1. 当前版本已满足 → 保留
    2. 未安装或不满足 → 遍历所有约束，取最高的下限版本

    注意：pip 实际行为是安装满足约束的最新版本（需查询 PyPI），
    这里采用保守策略，选择下限版本，宁可多报潜在冲突也不漏报。
    对于 > 约束，取 min_version + 1 patch 作为近似，仍可能产生少量误报。
    """
    if current is not None and spec_set.contains(current, prereleases=True):
        return current

    # 遍历所有约束，找到最高的下限版本
    floor: Version | None = None
    for spec in spec_set:
        if spec.operator == ">=":
            v = Version(spec.version)
        elif spec.operator == ">":
            # 严格大于：取下一个版本作为近似
            # >1.0.0 → 1.0.1，>1.0 → 1.1.0
            parts = spec.version.split(".")
            if len(parts) >= 3:
                v = Version(f"{parts[0]}.{parts[1]}.{int(parts[2]) + 1}")
            else:
                # 2 段版本如 >1.0 → 近似为 1.1.0
                v = Version(f"{parts[0]}.{int(parts[1]) + 1}.0")
        elif spec.operator == "==":
            v = Version(spec.version)
        elif spec.operator == "~=":
            # ~=X.Y.Z 等价于 >=X.Y.Z, ==X.Y.*，下限即为 X.Y.Z
            v = Version(spec.version)
        else:
            # !=, <, <= 均不影响下限
            continue

        if floor is None or v > floor:
            floor = v

    return floor


def detect_upgrade_impact(
    installed: dict[str, str],
    new_skill_deps: list[str],
    all_other_skills: list[dict],
) -> list[dict]:
    """
    模拟依赖升级，检查对其他 Skill 的影响。

    使用 packaging 库进行精确的版本解析与比较，
    正确处理复合约束（如 >=1.0,<2.0）和兼容版本（~=1.4.2）。

    Args:
        installed: 当前已安装依赖 {"package": "version"}
        new_skill_deps: 新 Skill 的依赖声明 ["package>=version", ...]
        all_other_skills: 该用户其他 Skill 的信息列表
            [{"name": "skill-b", "dependencies": ["requests>=2.28.0", ...]}]

    Returns:
        受影响的 Skill 列表
        [{"skill_name": str, "breaks": [{"package": str, ...}]}]
    """
    # 1. 构建模拟升级后的依赖状态
    simulated: dict[str, Version] = {
        k.lower(): Version(v) for k, v in installed.items()
    }

    for dep_str in new_skill_deps:
        try:
            req = Requirement(dep_str)
        except InvalidRequirement:
            continue  # 跳过无效依赖声明
        pkg_lower = req.name.lower()
        current = simulated.get(pkg_lower)

        if not req.specifier:
            continue  # 无版本约束，保留当前版本

        new_version = _pick_simulated_version(req.specifier, current)
        if new_version is not None:
            simulated[pkg_lower] = new_version

    # 2. 遍历其他 Skill，检查其依赖是否仍满足
    affected = []
    for skill in all_other_skills:
        warnings = []
        for dep_str in skill.get("dependencies", []):
            try:
                req = Requirement(dep_str)
            except InvalidRequirement:
                continue
            pkg_lower = req.name.lower()

            sim_version = simulated.get(pkg_lower)
            if sim_version is not None and req.specifier:
                if not req.specifier.contains(sim_version, prereleases=True):
                    warnings.append({
                        "package": req.name,
                        "installed_version": str(sim_version),
                        "required_version": str(req.specifier),
                    })

        if warnings:
            affected.append({
                "skill_name": skill.get("name", "unknown"),
                "breaks": warnings,
            })

    return affected
```

> **调用时机**：在冲突检测（`detect_dependency_conflicts`）之后、返回冲突信息给前端之前调用。影响预检结果随冲突信息一并返回给前端，展示在冲突对话框中（详见 `08-frontend-ux.md`）。
>
> **性能考虑**：此函数仅为内存中的字典遍历和版本比较，无 I/O 操作，对性能影响可忽略。

### 用户交互流程

````
前端检测到冲突响应
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 显示冲突对话框                                   │
  │                                                  │
  │ ⚠️ 检测到依赖版本冲突                            │
  │                                                  │
  │ 以下包的版本与您环境中已安装的版本不兼容：        │
  │                                                  │
  │ • requests                                       │
  │   已安装: 2.28.0                                 │
  │   需要: >=2.30.0                                 │
  │                                                  │
  │ （如有受影响 Skill，额外显示：）                  │
  │ ⚠️ 升级后以下 Skill 可能受影响：                  │
  │ • Skill B — 需要 requests>=2.28.0               │
  │ • Skill C — 需要 requests==2.28.0               │
  │                                                  │
  │ 选择操作：                                       │
  │                                                  │
  │ [允许安装]  [取消上传]                           │
  │                                                  │
  │ 提示：允许安装将卸载旧版本并安装新版本，         │
  │      可能影响您其他 skill 的运行。               │
  │      系统将在安装前自动保存依赖快照，            │
  │      如有问题可从快照恢复。                      │
  └─────────────────────────────────────────────────┘
````


---

**导航**： [← API 设计](./06-api-design.md) | [返回目录](./00-index.md) | [前端交互体验设计 →](./08-frontend-ux.md)