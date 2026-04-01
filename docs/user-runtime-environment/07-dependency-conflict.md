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

### 用户交互流程

```
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
  │ 选择操作：                                       │
  │                                                  │
  │ [允许安装]  [取消上传]                           │
  │                                                  │
  │ 提示：允许安装将卸载旧版本并安装新版本，         │
  │      可能影响您其他 skill 的运行。               │
  └─────────────────────────────────────────────────┘
```


---

**导航**： [← API 设计](./06-api-design.md) | [返回目录](./00-index.md) | [前端交互体验设计 →](./08-frontend-ux.md)