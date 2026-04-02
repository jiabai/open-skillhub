---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 环境清理策略

### 配置项

```yaml
# config/default.yaml

runtime:
  # 虚拟环境存储路径
  venv_storage_path: "${DATA_DIR}/venvs"
  
  # 空闲超时天数（超过此天数未使用的环境将被清理）
  idle_cleanup_days: 90
  
  # 是否启用自动清理
  auto_cleanup_enabled: true
  
  # 清理任务执行时间（cron 表达式）
  cleanup_cron: "0 3 * * *"  # 每天凌晨 3 点
  
  # Python 版本（用于创建虚拟环境）
  python_version: "3.11"
```

### 快照保留策略

依赖快照采用分类保留策略，避免无限增长：

```yaml
# config/default.yaml

runtime:
  # 自动快照（上传前保存）最大保留数量
  snapshot_auto_max_count: 20

  # 手动快照最大保留数量
  snapshot_manual_max_count: 5
```

| 快照类型 | 保留数量 | 清理时机 | 说明 |
|----------|----------|----------|------|
| 自动快照（`is_auto=true`） | 最多 20 条 | 每次创建新自动快照时 | 超出限制后删除最早的自动快照 |
| 手动快照（`is_auto=false`） | 最多 5 条 | 创建新手动快照时 | 超出限制后提示用户需先删除旧快照 |

**清理逻辑**：

```python
async def cleanup_dependency_snapshots(
    user_id: str,
    snapshot_repo: SnapshotRepository,
    auto_max: int = 20,
    manual_max: int = 5,
) -> None:
    """
    清理超出限制的依赖快照
    """
    # 清理自动快照
    auto_snapshots = await snapshot_repo.list_by_user(
        user_id, is_auto=True, order_by_desc="created_at"
    )
    if len(auto_snapshots) > auto_max:
        to_delete = auto_snapshots[auto_max:]
        for snapshot in to_delete:
            await snapshot_repo.delete(snapshot.id)

    # 检查手动快照数量（不自动删除，需用户手动管理）
    manual_count = await snapshot_repo.count_by_user(user_id, is_auto=False)
    if manual_count > manual_max:
        logger.warning(
            f"User {user_id} has {manual_count} manual snapshots, "
            f"exceeds limit {manual_max}"
        )
```

> **注意**：手动快照不自动清理，前端应在创建新快照时提示用户已达上限。

### 清理条件

| 条件 | 触发方式 | 清理范围 | 说明 |
|------|----------|----------|------|
| 空闲超时 + 无剩余 Skill | 定时任务 | 仅环境 | `venv_last_used_at` 超过配置天数 **且** 用户无剩余 Skill |
| 用户有剩余 Skill | 不清理 | - | 用户有 Skill 时环境必须保留（不受空闲超时限制） |
| 管理员触发 | 管理接口 | 仅环境 | 通过 `DELETE /api/v1/admin/users/{user_id}/runtime` 手动清理 |
| 用户删除所有 Skill | Skill 删除流程 | 仅环境（等待空闲清理） | 保留环境，`venv_last_used_at` 保持不变，等待空闲超时自动清理 |
| 用户删除账户 | 账户删除流程 | Skill + 环境 + 用户记录 | 级联清理，彻底删除所有资源（详见 `04-core-flows.md` 用户删除账户流程） |

### 清理逻辑代码示例

#### Repository 接口定义

```python
class UserRepository(Protocol):
    """用户仓库接口"""

    async def find_by_last_used_before(
        self, cutoff_time: datetime
    ) -> list[User]:
        """
        查询 venv_last_used_at 早于指定时间的用户

        Args:
            cutoff_time: 截止时间

        Returns:
            符合条件的用户列表
        """
        ...

    async def find_locked_users(self) -> list[User]:
        """
        查询 runtime_locked = True 的用户

        Returns:
            被锁定的用户列表
        """
        ...

    async def update(self, user: User) -> None:
        """更新用户记录"""
        ...


class SkillRepository(Protocol):
    """Skill 仓库接口"""

    async def count_by_user(self, user_id: str) -> int:
        """
        统计用户的 Skill 数量

        Args:
            user_id: 用户 ID

        Returns:
            Skill 数量
        """
        ...
```

#### 清理候选查询

```python
async def get_cleanup_candidates(
    user_repo: UserRepository,
    skill_repo: SkillRepository,
    idle_days: int,
) -> list[User]:
    """
    获取符合清理条件的用户

    条件：空闲超过阈值 AND 无剩余 Skill
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=idle_days)

    # 查询空闲超时的用户
    idle_users = await user_repo.find_by_last_used_before(cutoff_time)

    candidates = []
    for user in idle_users:
        # 检查是否有剩余 Skill
        skill_count = await skill_repo.count_by_user(user.id)
        if skill_count == 0:
            candidates.append(user)

    return candidates
```


---

**导航**： [← 前端交互体验设计](./08-frontend-ux.md) | [返回目录](./00-index.md) | [错误处理 →](./10-error-handling.md)