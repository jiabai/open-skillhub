---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 错误处理

### 错误码定义

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `RUNTIME_LOCKED` | 423 | 运行时环境正在更新（安装依赖），请等待 |
| `RUNTIME_NOT_INITIALIZED` | 400 | 用户运行时环境未初始化 |
| `DEPENDENCY_CONFLICT` | 409 | 依赖版本冲突，需要用户确认 |
| `DEPENDENCY_INSTALL_FAILED` | 500 | 依赖安装失败 |
| `VENV_CREATION_FAILED` | 500 | 虚拟环境创建失败 |
| `RUNTIME_DISK_QUOTA_EXCEEDED` | 507 | 运行时磁盘配额超限 |
| `SCRIPT_SECURITY_HIGH_RISK` | 403 | 脚本包含高风险操作，禁止上传 |
| `SCRIPT_SECURITY_REVIEW` | 202 | 脚本包含中等风险操作，需要用户确认 |

#### RUNTIME_LOCKED 错误响应格式

```json
{
  "error": "RUNTIME_LOCKED",
  "message": "Runtime environment is being updated, please wait",
  "lock_reason": "Installing dependencies",
  "locked_at": "2026-03-30T15:30:00Z",
  "retry_after": 30
}
```

#### SCRIPT_SECURITY_HIGH_RISK 错误响应格式

```json
{
  "error": "SCRIPT_SECURITY_HIGH_RISK",
  "message": "Script contains high-risk patterns and cannot be uploaded",
  "risks": [
    {
      "pattern": "os.system\\s*\\(",
      "description": "执行系统命令",
      "level": "high",
      "file": "scripts/main.py",
      "positions": [23, 45]
    }
  ]
}
```

#### SCRIPT_SECURITY_REVIEW 响应格式（需要确认）

```json
{
  "status": "security_review",
  "message": "Script contains medium-risk patterns, please review",
  "risks": [
    {
      "pattern": "requests\\.get\\s*\\(",
      "description": "HTTP 网络请求",
      "level": "medium",
      "file": "scripts/helper.py",
      "positions": [8]
    }
  ],
  "skill_uuid": "xxx-xxx-xxx",
  "require_confirmation": true
}
```

### 安装失败回滚

```python
async def upload_with_rollback(
    user: User,
    skill: Skill,
    filename: str,
    content: bytes,
    metadata: dict | None = None,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
) -> dict:
    """
    带回滚机制的上传流程
    """
    # 1. 加锁运行时环境
    user.runtime_locked = True
    user.runtime_lock_reason = "Installing dependencies"
    user.runtime_locked_at = datetime.now(timezone.utc)
    await user_repo.update(user)

    # 2. 备份当前状态
    backup_dependencies = dict(user.installed_dependencies or {})
    backup_venv_path = user.venv_path
    # 记录本次安装新增的依赖（用于回滚时卸载）
    newly_installed_packages = []

    try:
        # 3. 解析 SKILL.md metadata
        script_entry = metadata.get("script_entry", "main.py") if metadata else "main.py"
        skill.script_file = script_entry

        # 4. 检查/创建虚拟环境
        if not user.venv_path:
            # 首次上传：创建环境
            venv_path = await create_virtualenv(user.id)
            user.venv_path = str(venv_path)
            user.venv_created_at = datetime.now(timezone.utc)
            # 设置 skill_storage_path（用于级联删除）
            user.skill_storage_path = str(SKILL_STORAGE_PATH / user.id)
        else:
            # 环境已存在：更新使用时间
            user.venv_last_used_at = datetime.now(timezone.utc)

        # 5. 安装依赖（逐个安装，记录新安装的包）
        for dep in skill.dependencies:
            pkg_name, version_spec = parse_requirement(dep)

            # 检查是否已安装
            if pkg_name.lower() in (user.installed_dependencies or {}):
                installed_ver = user.installed_dependencies[pkg_name.lower()]
                if version_satisfies(installed_ver, version_spec):
                    # 已满足要求，跳过
                    continue

            # 安装依赖
            try:
                await install_single_dependency(user.venv_path, dep)
                newly_installed_packages.append(pkg_name)
            except Exception as e:
                raise DependencyInstallError(
                    package=pkg_name,
                    error=str(e),
                    newly_installed_packages=newly_installed_packages
                )

        # 6. 创建版本记录
        await skill_repo.create_version(skill)

        # 7. 更新用户记录（解锁）
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        user.installed_dependencies = await get_installed_packages(user.venv_path)
        await user_repo.update(user)

        return {"status": "success", "skill_id": skill.id}

    except DependencyInstallError as e:
        # 安装失败，回滚依赖（先回滚再解锁）
        logger.error(f"Dependency install failed: {e}")

        # 回滚策略：
        # 1. 卸载本次新安装的包
        # 2. 对于升级的包，恢复到备份版本（如果备份中有）
        await _rollback_new_packages(user, e.newly_installed_packages, backup_dependencies)

        # 恢复依赖记录
        user.installed_dependencies = backup_dependencies

        # 最后解锁
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)

        raise ValueError(f"Dependency install failed: {e}")

    except Exception as e:
        # 其他异常，确保解锁
        user.runtime_locked = False
        user.runtime_lock_reason = None
        user.runtime_locked_at = None
        await user_repo.update(user)
        raise


async def _rollback_new_packages(
    user: User,
    newly_installed: list[str],
    backup_dependencies: dict[str, str]
) -> None:
    """
    回滚新安装的依赖

    策略：
    1. 卸载本次新安装的包
    2. 对于已存在但被升级的包，降级回备份版本

    Args:
        user: 用户对象
        newly_installed: 本次新安装的包名列表
        backup_dependencies: 安装前的依赖状态备份
    """
    venv_path = Path(user.venv_path)
    pip_path = await get_pip_path(venv_path)

    for pkg_name in newly_installed:
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower in backup_dependencies:
            # 包已存在，需要降级到备份版本
            target_version = backup_dependencies[pkg_name_lower]
            logger.info(f"Rolling back {pkg_name} to version {target_version}")

            proc = await asyncio.create_subprocess_exec(
                str(pip_path), "install", f"{pkg_name}=={target_version}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
        else:
            # 全新安装的包，直接卸载
            logger.info(f"Uninstalling newly installed package: {pkg_name}")

            proc = await asyncio.create_subprocess_exec(
                str(pip_path), "uninstall", "-y", pkg_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
```


---

**导航**： [← 环境清理策略](./09-cleanup-strategy.md) | [返回目录](./00-index.md) | [实施计划 →](./11-implementation-plan.md)