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

### 清理条件

| 条件 | 触发方式 | 清理范围 | 说明 |
|------|----------|----------|------|
| 空闲超时 + 无剩余 Skill | 定时任务 | 仅环境 | `venv_last_used_at` 超过配置天数 **且** 用户无剩余 Skill |
| 用户有剩余 Skill | 不清理 | - | 用户有 Skill 时环境必须保留（不受空闲超时限制） |
| 管理员触发 | 管理接口 | 仅环境 | 通过 `DELETE /api/v1/admin/users/{user_id}/runtime` 手动清理 |
| 用户删除所有 Skill | Skill 删除流程 | 仅环境（等待空闲清理） | 保留环境，`venv_last_used_at` 保持不变，等待空闲超时自动清理 |
| 用户删除账户 | 账户删除流程 | Skill + 环境 + 用户记录 | 级联清理，彻底删除所有资源 |

### 清理逻辑代码示例

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