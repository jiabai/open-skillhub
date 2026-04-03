---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 附录

### A. 依赖解析工具函数

```python
import re
from packaging import version, requirements

# 日志记录器（代码示例使用）
import logging
logger = logging.getLogger(__name__)


def parse_requirement(req_str: str) -> tuple[str, str]:
    """
    解析依赖字符串

    Args:
        req_str: 如 "requests>=2.28.0" 或 "numpy"

    Returns:
        (package_name, version_spec)
    """
    req_str = req_str.strip()

    # 匹配包名和版本规范
    # PyPI 包名允许字母、数字、下划线、连字符和点号
    # 例如：google-api-python-client, beautifulsoup4
    match = re.match(r'^([a-zA-Z0-9_.-]+)\s*(.*)$', req_str)
    if not match:
        raise ValueError(f"Invalid requirement: {req_str}")

    pkg_name = match.group(1).lower()
    version_spec = match.group(2).strip()

    return pkg_name, version_spec


def version_satisfies(installed: str, spec: str, strict_mode: bool = True) -> bool:
    """
    检查已安装版本是否满足版本规范

    Args:
        installed: 已安装版本，如 "2.28.0"
        spec: 版本规范，如 ">=2.30.0" 或 ""
        strict_mode: 是否启用严格模式（默认 True）
            - True: 解析失败时返回 False（安全默认，拒绝潜在不兼容依赖）
            - False: 解析失败时返回 True（宽松模式，允许通过）

    Returns:
        是否满足

    Security Note:
        默认采用"安全拒绝"策略（strict_mode=True）。
        解析失败时返回 False，防止恶意构造的版本规范字符串绕过冲突检测。
        例如：攻击者构造 ">=!malicious" 可能导致解析异常，
        严格模式下返回 False，确保冲突检测不会被绕过。
        仅在明确配置宽松模式时才返回 True。
    """
    if not spec:
        return True

    try:
        installed_ver = version.parse(installed)
        req = requirements.Requirement(f"package{spec}")
        return installed_ver in req.specifier
    except Exception as e:
        # 解析失败时根据模式决定默认行为
        logger.warning(f"Failed to parse version spec '{spec}' or version '{installed}': {e}")
        if strict_mode:
            logger.info("Strict mode enabled: returning False (safe rejection)")
            return False
        else:
            logger.info("Strict mode disabled: returning True (lenient pass)")
            return True
```

### B. 虚拟环境管理工具函数

```python
import asyncio
import platform
import shutil
import sys
from pathlib import Path

# 日志记录器（代码示例使用）
import logging
logger = logging.getLogger(__name__)


async def create_virtualenv(
    venv_path: Path,
    python_version: str = "3.11"
) -> bool:
    """
    创建虚拟环境

    Args:
        venv_path: 虚拟环境路径
        python_version: Python 版本（如 "3.11"），用于查找对应的 Python 解释器

    Returns:
        是否成功

    Note:
        Python 版本解析策略：
        1. 尝试使用 `python{version}` 命令（如 python3.11）
        2. 如果不存在，回退到系统默认 `python` 命令并记录警告
        3. Windows 下尝试 `python.exe` 和 `py -{version}` 命令
    """
    if venv_path.exists():
        shutil.rmtree(venv_path)

    venv_path.parent.mkdir(parents=True, exist_ok=True)

    # 根据 Python 版本确定解释器命令
    if platform.system() == "Windows":
        # Windows: 尝试 py 启动器或直接使用 python
        python_cmd = f"py -{python_version}"
    else:
        # Linux/Mac: 使用 python3.x 命令
        python_cmd = f"python{python_version}"

    # 尝试使用指定版本
    proc = await asyncio.create_subprocess_exec(
        python_cmd, "-m", "venv", str(venv_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await proc.communicate()

    # 如果指定版本不存在，回退到系统默认 python
    if proc.returncode != 0:
        logger.warning(
            f"Python {python_version} not found ({python_cmd}), "
            f"falling back to system default"
        )
        # 清理首次尝试可能留下的残留目录
        shutil.rmtree(venv_path, ignore_errors=True)
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "venv", str(venv_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        logger.error(f"Failed to create venv: {stderr.decode()}")
        return False

    logger.info(f"Created virtual environment at {venv_path}")
    return True


async def get_pip_path(venv_path: Path) -> Path:
    """
    获取虚拟环境中的 pip 路径
    """
    if platform.system() == "Windows":
        return venv_path / "Scripts" / "pip.exe"
    else:
        # Linux/Mac
        return venv_path / "bin" / "pip"


async def get_python_path(venv_path: Path) -> Path:
    """
    获取虚拟环境中的 Python 路径
    """
    if platform.system() == "Windows":
        return venv_path / "Scripts" / "python.exe"
    else:
        # Linux/Mac
        return venv_path / "bin" / "python"
```

### C. Skill 删除与账户级联清理

```python
import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Protocol

# 配置常量（从配置文件或环境变量获取）
SKILL_STORAGE_PATH = Path("/data/skills")  # 示例路径，实际从配置读取

# 审计日志记录器接口（示例）
class AuditLogger(Protocol):
    """审计日志记录器接口"""

    def log_account_deletion(
        self,
        user_id: str,
        skills_deleted: int,
        disk_freed_mb: float,
        duration_ms: float
    ) -> None:
        ...


async def delete_skill(
    user: User,
    skill: Skill,
    skill_repo: SkillRepository,
) -> dict:
    """
    删除单个 Skill

    注意：不卸载依赖，保持环境不变
    """
    # 1. 检查运行时锁状态
    if user.runtime_locked:
        raise RuntimeLockedError(  # 错误码: RUNTIME_LOCKED
            reason=user.runtime_lock_reason,
            locked_at=user.runtime_locked_at,
            retry_after=30
        )

    # 2. 删除 Skill 文件
    skill_path = Path(skill.skill_dir)
    if skill_path.exists():
        shutil.rmtree(skill_path)

    # 3. 删除版本记录
    await skill_repo.delete_versions(skill.id)

    # 4. 删除 Skill 记录
    await skill_repo.delete(skill.id)

    # 5. 依赖不卸载，环境保持不变
    # 其他 Skill 可能使用相同依赖

    return {
        "status": "success",
        "skill_id": skill.id,
        "dependencies_preserved": True,
    }


async def on_last_skill_deleted(
    user: User,
    user_repo: UserRepository,
) -> dict:
    """
    用户删除最后一个 Skill 时的处理

    环境保留，venv_last_used_at 保持不变（反映最后一次实际使用时间）
    空闲清理策略：当用户无剩余 Skill AND 空闲天数超过阈值时清理
    """
    # venv_last_used_at 保持不变，不更新为当前时间
    # 因为用户删除 Skill 并非"使用"环境，而是不再需要环境
    # 空闲清理策略会检查：无剩余 Skill + 空闲超时 = 清理

    return {
        "status": "success",
        "message": "Environment preserved for potential future use",
        "cleanup_policy": "Will be cleaned when idle days exceed threshold AND user has no remaining Skills",
        "venv_last_used_at": user.venv_last_used_at.isoformat() if user.venv_last_used_at else None,
    }


async def delete_user_account(
    user: User,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
    audit_logger: AuditLogger,
) -> dict:
    """
    删除用户账户（级联清理）

    清理顺序：Skill 文件 → 环境 → 用户记录

    ⚠️ **重要**：必须先获取路径信息再删除用户记录，
    否则删除用户后将无法获取 venv_path。
    """
    start_time = datetime.now(timezone.utc)

    # 1. 删除所有 Skill 文件
    # 注意：必须先获取 skills 列表和路径，再执行删除
    skills = await skill_repo.list_by_user(user.id)
    disk_freed_mb = 0

    # 用户 Skill 根目录通过配置常量动态拼接
    skill_storage_path = SKILL_STORAGE_PATH / user.id
    if skill_storage_path.exists():
        # 计算磁盘空间
        disk_freed_mb += sum(
            f.stat().st_size for f in skill_storage_path.rglob("*") if f.is_file()
        ) / (1024 * 1024)
        shutil.rmtree(skill_storage_path)

    # 删除 Skill 记录
    for skill in skills:
        await skill_repo.delete_versions(skill.id)
        await skill_repo.delete(skill.id)

    # 2. 级联清理运行时环境
    # 安全检查：venv_path 可能为 None（用户从未创建过环境）
    if user.venv_path:
        venv_path = Path(user.venv_path)
        if venv_path.exists():
            # 计算磁盘空间
            disk_freed_mb += sum(
                f.stat().st_size for f in venv_path.rglob("*") if f.is_file()
            ) / (1024 * 1024)
            # 删除虚拟环境目录
            shutil.rmtree(venv_path)

    # 3. 删除用户记录（最后执行）
    await user_repo.delete(user.id)

    # 4. 记录审计日志
    duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
    audit_logger.log_account_deletion(
        user_id=user.id,
        skills_deleted=len(skills),
        disk_freed_mb=disk_freed_mb,
        duration_ms=duration_ms,
    )

    return {
        "status": "success",
        "user_id": user.id,
        "skills_deleted": len(skills),
        "disk_freed_mb": round(disk_freed_mb, 2),
        "duration_ms": round(duration_ms, 2),
    }
```

### D. Skill 版本回滚

```python
from datetime import datetime, timezone
from pathlib import Path


async def rollback_skill_version(
    user: User,
    skill: Skill,
    target_version: str,
    skill_repo: SkillRepository,
    user_repo: UserRepository,
) -> dict:
    """
    回滚 Skill 到指定版本

    注意：依赖不回滚，使用当前环境
    """
    # 1. 检查运行时锁状态
    if user.runtime_locked:
        raise RuntimeLockedError(
            reason=user.runtime_lock_reason,
            locked_at=user.runtime_locked_at,
            retry_after=30
        )

    # 2. 检查用户环境是否存在
    if not user.venv_path:
        raise RuntimeNotInitializedError(  # 错误码: RUNTIME_NOT_INITIALIZED
            "User runtime environment not initialized"
        )

    # 3. 检查目标版本是否存在
    target_version_record = await skill_repo.get_version(
        skill.id, target_version
    )
    if not target_version_record:
        raise ValueError(f"Version {target_version} not found")

    # 4. 获取目标版本的依赖声明（用于兼容性检查）
    target_dependencies = target_version_record.dependencies or []

    # 5. 检查依赖兼容性（强制检查，仅警告不阻止）
    compatibility_issues = check_dependency_compatibility(
        user.installed_dependencies,
        target_dependencies,
    )

    # 6. 如果存在兼容性问题，返回警告状态（需用户确认）
    if compatibility_issues:
        return {
            "status": "compatibility_warning",
            "skill_id": skill.id,
            "target_version": target_version,
            "compatibility_issues": compatibility_issues,
            "require_confirmation": True,
        }

    # 7. 无兼容性问题，更新版本指针
    skill.current_version = target_version
    skill.updated_at = datetime.now(timezone.utc)
    await skill_repo.update(skill)

    # 8. 更新用户最后使用时间
    user.venv_last_used_at = datetime.now(timezone.utc)
    await user_repo.update(user)

    return {
        "status": "success",
        "skill_id": skill.id,
        "rolled_back_to": target_version,
        "dependencies_preserved": True,
        "compatibility_issues": [],
    }


def check_dependency_compatibility(
    installed: dict[str, str],
    required: list[str],
) -> list[dict]:
    """
    检查依赖兼容性（用于提供警告）

    与冲突检测类似，但只是警告，不阻止操作

    Args:
        installed: 已安装依赖 {"package": "version"}
        required: 需要的依赖声明 ["package>=version", ...]

    Returns:
        警告列表
    """
    warnings = []

    # 构建小写化的已安装依赖映射，确保大小写不敏感匹配
    installed_lower = {k.lower(): v for k, v in installed.items()}

    for req in required:
        pkg_name, version_spec = parse_requirement(req)
        pkg_name_lower = pkg_name.lower()

        if pkg_name_lower in installed_lower:
            installed_version = installed_lower[pkg_name_lower]

            if not version_satisfies(installed_version, version_spec):
                warnings.append({
                    "package": pkg_name,
                    "installed_version": installed_version,
                    "required_version": version_spec,
                    "warning_type": "version_mismatch",
                    "message": f"Installed {pkg_name}={installed_version} "
                               f"may not satisfy {version_spec}",
                })
        else:
            warnings.append({
                "package": pkg_name,
                "installed_version": None,
                "required_version": version_spec,
                "warning_type": "missing",
                "message": f"Package {pkg_name} is not installed",
            })

    return warnings
```

### E. 依赖快照保存与恢复

```python
import asyncio
from pathlib import Path
from datetime import datetime, timezone

# 配置常量（从配置文件获取）
DEPENDENCY_OPERATION_TIMEOUT = 300  # 单个 pip 操作超时（秒），默认 5 分钟


async def save_dependency_snapshot(
    user_id: str,
    reason: str,
    dependencies: dict[str, str],
    snapshot_repo: SnapshotRepository,
    is_auto: bool = True,
    auto_max: int = 20,
) -> "Snapshot":
    """
    保存当前依赖状态快照

    自动快照创建后会立即执行内联清理，删除超出限制的最早快照。
    完整实现见 docs/user-runtime-environment/09-cleanup-strategy.md。

    Args:
        user_id: 用户 ID
        reason: 快照原因，如 "pre_deploy:skill-a:v2.0.0"
        dependencies: 当前依赖状态 {"package": "version"}
        snapshot_repo: 快照仓库
        is_auto: 是否为自动快照（默认 True）
        auto_max: 自动快照最大数量（默认 20）

    Returns:
        创建的快照对象

    Note:
        参数顺序与 09-cleanup-strategy.md 中的定义保持一致。
        此处为简化示例，省略了内联清理逻辑（cleanup_dependency_snapshots）。
    """
    snapshot = await snapshot_repo.create(
        user_id=user_id,
        dependencies=dict(dependencies or {}),
        reason=reason,
        is_auto=is_auto,
    )
    return snapshot


async def restore_dependencies_from_snapshot(
    user: User,
    snapshot: DependencySnapshot,
    snapshot_repo: SnapshotRepository,
    user_repo: UserRepository,
    timeout: int = DEPENDENCY_OPERATION_TIMEOUT,
) -> dict:
    """
    从快照恢复依赖环境

    注意：调用前应已加锁

    Args:
        user: 用户对象
        snapshot: 目标快照对象
        snapshot_repo: 快照仓库
        user_repo: 用户仓库
        timeout: 单个 pip 操作超时时间（秒），默认 300 秒

    Returns:
        恢复结果

    Raises:
        TimeoutError: pip 操作超时
        RuntimeError: pip 操作失败
    """
    # 1. 保存当前状态作为安全备份（恢复失败时可回退）
    backup_snapshot_id = await save_dependency_snapshot(
        user_id=user.id,
        reason=f"pre_restore:{snapshot.reason}",
        dependencies=dict(user.installed_dependencies or {}),
        snapshot_repo=snapshot_repo,
        is_auto=True,
    )

    # 2. 计算依赖差异
    current_deps = {k.lower(): v for k, v in (user.installed_dependencies or {}).items()}
    target_deps = {k.lower(): v for k, v in snapshot.dependencies.items()}

    to_uninstall = [pkg for pkg in current_deps if pkg not in target_deps]
    to_install = [pkg for pkg in target_deps if pkg not in current_deps]
    to_downgrade = [
        pkg for pkg in target_deps
        if pkg in current_deps and current_deps[pkg] != target_deps[pkg]
    ]

    venv_path = Path(user.venv_path)
    pip_path = await get_pip_path(venv_path)

    try:
        # 3. 卸载快照中没有的包
        # 收集卸载失败的包名，在最终结果中返回供用户知晓
        uninstall_failures = []
        for pkg_name in to_uninstall:
            proc = await asyncio.create_subprocess_exec(
                str(pip_path), "uninstall", "-y", pkg_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            # 使用 asyncio.wait_for 设置超时，防止网络问题导致无限等待
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout
            )
            if proc.returncode != 0:
                logger.warning(
                    f"Failed to uninstall {pkg_name}: {stderr.decode()}"
                )
                uninstall_failures.append(pkg_name)
                # 卸载失败不中断流程，pip 卸载非关键包失败通常不影响环境完整性

        # 4. 安装快照中有但当前没有的包
        for pkg_name in to_install:
            version = target_deps[pkg_name]
            proc = await asyncio.create_subprocess_exec(
                str(pip_path), "install", f"{pkg_name}=={version}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            # 使用 asyncio.wait_for 设置超时
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout
            )
            if proc.returncode != 0:
                raise RuntimeError(
                    f"Failed to install {pkg_name}=={version}: {stderr.decode()}"
                )

        # 5. 降级版本不同的包
        for pkg_name in to_downgrade:
            target_version = target_deps[pkg_name]
            proc = await asyncio.create_subprocess_exec(
                str(pip_path), "install", f"{pkg_name}=={target_version}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            # 使用 asyncio.wait_for 设置超时
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout
            )
            if proc.returncode != 0:
                raise RuntimeError(
                    f"Failed to install {pkg_name}=={target_version}: {stderr.decode()}"
                )

        # 6. 更新用户依赖记录
        user.installed_dependencies = dict(snapshot.dependencies)
        user.venv_last_used_at = datetime.now(timezone.utc)
        await user_repo.update(user)

        return {
            "status": "success",
            "restored_dependencies": snapshot.dependencies,
            "backup_snapshot_id": backup_snapshot_id,
            "to_uninstall": to_uninstall,
            "to_install": to_install,
            "to_downgrade": to_downgrade,
            "uninstall_failures": uninstall_failures,
        }

    except asyncio.TimeoutError as e:
        # pip 操作超时
        logger.error(
            f"Dependency restore timeout after {timeout}s: {e}, "
            f"backup snapshot: {backup_snapshot_id}"
        )
        raise TimeoutError(
            f"Dependency operation timed out after {timeout} seconds. "
            f"Backup snapshot {backup_snapshot_id} is available for manual recovery."
        )

    except Exception as e:
        # 恢复失败：不自动回退（已有 backup_snapshot_id 供手动恢复）
        logger.error(
            f"Dependency restore failed: {e}, "
            f"backup snapshot: {backup_snapshot_id}"
        )
        raise ValueError(
            f"Dependency restore failed: {e}. "
            f"Backup snapshot {backup_snapshot_id} is available for manual recovery."
        )
```

**导航**： [← 监控指标](./13-monitoring.md) | [返回目录](./00-index.md)