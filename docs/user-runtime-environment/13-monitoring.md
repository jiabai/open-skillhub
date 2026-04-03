---
status: draft
ai_read: true
last_updated: 2026-04-03
parent: user-runtime-environment
---

## 监控指标

### 部署相关指标（新增）

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `deploy_total_count` | 部署触发总次数 | - |
| `deploy_success_count` | 部署成功次数 | - |
| `deploy_failure_count` | 部署失败次数 | > 10/天 |
| `deploy_failure_rate` | 部署失败率 | > 10% |
| `deploy_duration_seconds` | 部署耗时（含依赖安装） | P95 > 120s |
| `deploy_retry_count` | 部署重试次数 | - |
| `deploy_conflict_count` | 部署时检测到依赖冲突次数 | - |
| `skill_pending_deploy_count` | 处于 pending 状态的 Skill 数量 | - |
| `skill_installing_count` | 正在部署中的 Skill 数量 | > 5 并发 |
| `skill_failed_deploy_count` | 部署失败的 Skill 数量 | > 0 时关注 |

### 虚拟环境指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `venv_total_count` | 虚拟环境总数 | - |
| `venv_disk_usage_bytes` | 虚拟环境磁盘占用 | > 80% 容量 |
| `venv_creation_duration_seconds` | 环境创建耗时 | P95 > 30s |

### 依赖安装指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `dependency_install_duration_seconds` | 依赖安装耗时 | P95 > 60s |
| `dependency_install_failure_rate` | 依赖安装失败率 | > 5% |
| `dependency_conflict_rate` | 依赖冲突率 | - |

### 运行时锁指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `runtime_lock_duration_seconds` | 运行时锁持续时间 | P95 > 120s |
| `runtime_lock_wait_count` | 因锁等待的执行请求数 | - |
| `runtime_lock_timeout_count` | 锁超时自动取消次数 | > 10/天 |

### 脚本安全指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `script_scan_high_risk_count` | 高风险脚本检测次数 | > 0 时审计 |
| `script_scan_medium_risk_count` | 中风险脚本检测次数 | - |
| `script_scan_rejection_rate` | 因安全风险拒绝上传率 | > 1% |

### 执行指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `skill_execution_duration_seconds` | Skill 执行耗时 | P95 > 30s |
| `skill_execution_success_rate` | Skill 执行成功率 | < 95% |
| `skill_execution_not_ready_count` | 因未部署被拒绝的执行次数 | - |

### 清理与维护指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `skill_delete_count` | Skill 删除次数 | - |
| `cascade_cleanup_duration_seconds` | 级联清理耗时 | P95 > 30s |
| `dependency_snapshot_count` | 依赖快照总数 | - |
| `dependency_restore_count` | 依赖恢复操作次数 | > 0 时审计 |
| `dependency_restore_failure_rate` | 依赖恢复失败率 | > 5% |
| `unused_dependency_count` | 未使用的已安装依赖数 | - |

### 版本管理指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| `skill_rollback_count` | 版本回滚次数 | - |
| `rollback_compatibility_warning_rate` | 回滚时兼容性警告率 | - |


---

**导航**： [← 安全考虑](./12-security.md) | [返回目录](./00-index.md) | [附录 →](./14-appendix.md)
