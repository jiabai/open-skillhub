---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `venv_total_count` | 虚拟环境总数 | - |
| `venv_disk_usage_bytes` | 虚拟环境磁盘占用 | > 80% 容量 |
| `venv_creation_duration_seconds` | 环境创建耗时 | P95 > 30s |
| `dependency_install_duration_seconds` | 依赖安装耗时 | P95 > 60s |
| `dependency_install_failure_rate` | 依赖安装失败率 | > 5% |
| `dependency_conflict_rate` | 依赖冲突率 | - |
| `runtime_lock_duration_seconds` | 运行时锁持续时间 | P95 > 120s |
| `runtime_lock_wait_count` | 因锁等待的执行请求数 | - |
| `runtime_lock_timeout_count` | 锁超时自动取消次数 | > 10/天 |
| `script_scan_high_risk_count` | 高风险脚本检测次数 | > 0 时审计 |
| `script_scan_medium_risk_count` | 中风险脚本检测次数 | - |
| `script_scan_low_risk_count` | 低风险脚本检测次数 | - |
| `script_scan_rejection_rate` | 因安全风险拒绝上传率 | > 1% |
| `skill_execution_duration_seconds` | Skill 执行耗时 | P95 > 30s |
| `skill_execution_success_rate` | Skill 执行成功率 | < 95% |
| `skill_execution_error_count` | Skill 执行错误次数 | - |
| `skill_execution_timeout_count` | Skill 执行超时次数 | > 5/天 |
| `skill_delete_count` | Skill 删除次数 | - |
| `skill_delete_all_users_count` | 删除所有 Skill 的用户数 | - |
| `user_account_delete_count` | 用户账户删除次数 | > 0 时审计 |
| `cascade_cleanup_duration_seconds` | 级联清理耗时 | P95 > 30s |
| `skill_rollback_count` | Skill 版本回滚次数 | - |
| `rollback_compatibility_warning_rate` | 回滚时依赖兼容性警告率 | - |
| `unused_dependency_count` | 未被 Skill 使用但已安装的依赖数 | - |
| `unused_dependency_cleanup_count` | 手动清理未使用依赖次数 | - |
| `unused_dependency_disk_freed_kb` | 清理未使用依赖释放的磁盘空间 | - |
| `dependency_snapshot_count` | 依赖快照总数 | - |
| `dependency_snapshot_auto_count` | 自动依赖快照数量 | - |
| `dependency_restore_count` | 依赖恢复操作次数 | > 0 时审计 |
| `dependency_restore_failure_rate` | 依赖恢复失败率 | > 5% |
| `dependency_restore_duration_seconds` | 依赖恢复耗时 | P95 > 60s |
| `upgrade_impact_warning_rate` | 升级影响预检发现受影响 Skill 的比率 | - |


---

**导航**： [← 安全考虑](./12-security.md) | [返回目录](./00-index.md) | [附录 →](./14-appendix.md)