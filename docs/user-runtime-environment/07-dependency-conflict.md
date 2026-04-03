---
status: draft
ai_read: true
last_updated: 2026-04-03
parent: user-runtime-environment
---

## 依赖冲突处理

### 冲突检测时机

依赖冲突检测在**部署阶段**执行。上传阶段仅解析依赖声明（不安装），部署阶段才执行实际安装，因此冲突检测在此时进行。

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
        required: 需要安装的依赖 ["package>=version", ...]

    Returns:
        冲突列表 [{"package": str, "installed_version": str,
                  "required_version": str, "conflict_type": str}]
    """
    conflicts = []

    installed_lower = {k.lower(): v for k, v in installed.items()}

    for req in required:
        pkg_name, version_spec = parse_requirement(req)
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower in installed_lower:
            installed_version = installed_lower[pkg_name_lower]

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

在用户确认「允许安装」之前，系统应模拟升级后的依赖状态，检查该用户所有其他 Skill 的依赖声明是否仍然满足。

```python
def detect_upgrade_impact(
    installed: dict[str, str],
    new_skill_deps: list[str],
    all_other_skills: list[dict],
) -> list[dict]:
    """
    模拟依赖升级，检查对其他 Skill 的影响。

    Args:
        installed: 当前已安装依赖 {"package": "version"}
        new_skill_deps: 新 Skill 的依赖声明 ["package>=version", ...]
        all_other_skills: 该用户其他 Skill 的信息列表
            [{"name": "skill-b", "dependencies": ["requests>=2.28.0", ...]}]

    Returns:
        受影响的 Skill 列表
    """
    # 1. 构建模拟升级后的依赖状态
    simulated: dict[str, Version] = {
        k.lower(): Version(v) for k, v in installed.items()
    }

    for dep_str in new_skill_deps:
        try:
            req = Requirement(dep_str)
        except InvalidRequirement:
            continue
        pkg_lower = req.name.lower()
        current = simulated.get(pkg_lower)

        if not req.specifier:
            continue

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
                if not req.specifier.contains(sim_version, prereleases=False):
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


def _pick_simulated_version(
    specifier: "SpecifierSet",
    current: "Version | None",
) -> "Version | None":
    """
    为模拟升级选择一个版本号。

    策略：选择满足 specifier 的最小版本（保守估计）。
    若无法确定具体版本（specifier 为开放范围如 >=1.0），
    则在当前版本基础上取 specifier 下限 + 1 个 patch。

    Args:
        specifier: 版本约束条件集（如 >=2.30.0）
        current: 当前已安装版本（可能为 None）

    Returns:
        模拟版本号，若无法确定则返回 None

    Note:
        模拟版本与实际安装版本的关系取决于场景：

        - **升级场景**（当前版本低于 specifier 下限）：模拟版本取下限值，
          可能高于 pip 实际安装的版本 → 假阳性（安全方向）。
        - **降级场景**（当前版本高于 specifier 上限）：模拟版本取下限值，
          低于当前版本。例如当前 `2.31.0`，新 Skill 要求 `~=2.30.0`（即
          `>=2.30.0,<2.31.0`），模拟版本为 `2.30.0`，正确反映 pip 将降级安装。

        两种场景均不会产生假阴性，符合安全优先原则。
    """
    # 尝试从 specifier 中提取下限版本
    lower_bounds = []
    for spec in specifier:
        op, ver_str = spec.operator, spec.version
        if op in (">=", "==", "~=", "==="):
            # 注意：~= 操作符（如 ~=2.30.0 等价于 >=2.30.0,<2.31.0）隐含上限约束。
            # 此处仅取下限作为保守估计。
            # - 升级场景：模拟版本可能高于 pip 实际安装的版本 → 假阳性
            # - 降级场景：模拟版本（下限）可能低于当前版本 → 正确反映降级
            lower_bounds.append(Version(ver_str))
        elif op == ">":
            # >1.0 的保守估计：取满足约束的最小版本
            # 通过 bump patch 实现（如 1.0 → 1.0.1）
            base = Version(ver_str)
            lower_bounds.append(Version(f"{base.major}.{base.minor}.{base.patch + 1}"))

    if not lower_bounds:
        # 无下限约束（如裸版本号或不常见操作符），保守取当前版本 + patch bump
        if current is not None:
            return Version(f"{current.major}.{current.minor}.{current.patch + 1}")
        return None

    # 取所有下限中的最大值作为模拟版本
    # 升级场景：可能高于 pip 实际安装 → 假阳性（安全方向）
    # 降级场景：低于当前版本 → 正确反映 pip 降级行为
    # 两种场景均不会产生假阴性。
    return max(lower_bounds)
```

> **调用时机**：在部署阶段的冲突检测（`detect_dependency_conflicts`）之后、返回冲突信息给前端之前调用。影响预检结果随冲突信息一并返回给前端。

### 用户交互流程

冲突发生在**部署阶段**，而非上传阶段：

````
用户点击「部署运行环境」
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 后端检测依赖冲突                                │
  │                                                  │
  │ ⚠️ 检测到依赖版本冲突                            │
  │                                                  │
  │ • requests                                       │
  │   已安装: 2.28.0    需要: >=2.30.0               │
  │                                                  │
  │ ⚠️ 升级后以下 Skill 可能受影响：                  │
  │ • Skill B — 需要 requests>=2.28.0               │
  │ • Skill C — 需要 requests==2.28.0               │
  │                                                  │
  │ [允许安装]  [取消部署]                           │
  │                                                  │
  │ 提示：系统将在安装前自动保存依赖快照，            │
  │      如有问题可从快照恢复。                      │
  └─────────────────────────────────────────────────┘
````


---

**导航**： [← API 设计](./06-api-design.md) | [返回目录](./00-index.md) | [前端交互体验设计 →](./08-frontend-ux.md)
