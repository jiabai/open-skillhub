---
status: draft
ai_read: true
last_updated: 2026-04-03
parent: user-runtime-environment
---

## 实施计划

### Phase 1: 数据模型和基础设施（P0）

- [ ] 数据库迁移：添加 `users` 表新字段（venv、锁字段）
- [ ] 数据库迁移：添加 `skills` 表新字段（`install_status`、`install_error`、`dependencies`、`script_file`）
- [ ] 数据库迁移：添加 `skill_versions` 表新字段（`script_file`、`storage_path`）
- [ ] 数据库迁移：创建 `dependency_snapshots` 表（含外键级联删除）
- [ ] 配置项：添加运行时相关配置
- [ ] 工具函数：虚拟环境创建、依赖解析

### Phase 2: 安全扫描机制（P0）

- [ ] 风险模式定义：HIGH/MEDIUM/LOW 级别模式列表
- [ ] 脚本扫描服务：`ScriptScanner` 类实现
- [ ] 上传流程集成：在 ZIP 解压后执行扫描
- [ ] 前端安全审查对话框：高风险拒绝、中风险确认

### Phase 3: 上传流程改造（P0）

- [ ] 修改 `SkillService.upload_zip`：不再安装依赖，仅验证和解析
- [ ] 上传完成后设置 `install_status = pending`
- [ ] SKILL.md metadata 解析：提取 `script_entry` 设置 `script_file` 字段
- [ ] 临时文件清理：上传完成/失败后清理临时目录
- [ ] 安全审查超时惰性检查：`/resolve-security` 接口入口检查临时目录 mtime，过期则清理并返回 `UPLOAD_SESSION_EXPIRED`
- [ ] 上传阶段不加锁（仅验证和解析）

### Phase 4: 部署模块（P0，新增）

> **核心新增模块**，实现上传与部署分离设计。

- [ ] 实现依赖快照服务：自动保存、手动保存、按用户查询
- [ ] 实现部署服务：`DeployService.deploy()` 核心逻辑
- [ ] 部署前置检查：`install_status` 为 pending 或 failed
- [ ] 部署加锁机制：加锁 → 安装 → 解锁
- [ ] 依赖冲突检测：部署时检测（从上传阶段迁移）
- [ ] 升级影响预检：`detect_upgrade_impact()` 函数
- [ ] 依赖安装 + 回滚：`deploy_with_rollback()` 函数
- [ ] 新增 API：`POST /api/v1/skills/{skill_uuid}/deploy`（触发部署）
- [ ] 新增 API：`POST /api/v1/skills/{skill_uuid}/deploy/confirm`（确认无冲突部署）
- [ ] 新增 API：`POST /api/v1/skills/{skill_uuid}/deploy/resolve-conflict`（解决冲突）
- [ ] 新增 API：`GET /api/v1/skills/{skill_uuid}/deploy-status`（安装进度轮询）
- [ ] 前端部署状态标识组件（红/黄/绿）
- [ ] 前端部署按钮和流程交互
- [ ] 前端依赖预览对话框组件
- [ ] 前端冲突对话框组件（含受影响 Skill 列表）
- [ ] 前端安装进度组件（轮询方式）
- [ ] 前端部署失败详情组件

### Phase 5: 执行流程改造（P0）

- [ ] 修改 `ExecuteSkillOp`：使用用户虚拟环境
- [ ] **新增**：执行前检查 `install_status == ready`
- [ ] **新增**：`install_status != ready` 时返回 `RUNTIME_NOT_READY` 错误
- [ ] 环境变量清理：`build_safe_environment` 函数
- [ ] 运行时锁检查：执行前检查 `runtime_locked`
- [ ] 更新使用时间戳

### Phase 6: 依赖恢复功能（P1）

- [ ] 实现依赖恢复服务：计算差异、执行 pip 操作、失败回滚
- [ ] 新增 API：`GET /runtime/dependency-snapshots`（快照列表）
- [ ] 新增 API：`POST /runtime/dependency-snapshots`（创建手动快照）
- [ ] 新增 API：`DELETE /runtime/dependency-snapshots/{id}`（删除快照）
- [ ] 新增 API：`POST /runtime/dependency-snapshots/{id}/restore`（恢复快照）
- [ ] 前端恢复结果展示组件（显示兼容/不兼容 Skill 列表）
- [ ] 前端环境管理页面增加依赖快照历史和恢复入口
- [ ] 快照保留策略实现

### Phase 7: 管理功能（P1）

- [ ] 管理接口：查询用户环境状态（含 `skills_by_status` 字段）
- [ ] 管理接口：清理用户环境（清理后重置 Skill `install_status`）
- [ ] 管理接口：清理未使用依赖（含 dry_run 模式）
- [ ] 定时任务：自动清理空闲环境
- [ ] 定时任务：清理超时的运行时锁（**必须实现进程存活检查**：对于 `Deploying dependencies` / `Creating virtual environment` / `Restoring dependencies` / `Rolling back version` 类型的锁，超时前须检查关联的后台进程是否仍在运行；仅在进程已结束或无法确定时才执行解锁。详见 [并发安全机制 - 超时解锁安全性分类](./05-concurrency.md#超时解锁安全性分类)）
- [ ] 定时任务：清理超时的上传会话临时文件（扫描 `runtime_temp_path IS NOT NULL` 且目录过期）
- [ ] 前端：依赖管理页面

### Phase 8: 监控指标（P1）

- [ ] 实现 `deploy_duration_seconds` 指标采集（新增）
- [ ] 实现 `deploy_failure_rate` 指标采集（新增）
- [ ] 实现 `deploy_retry_count` 指标采集（新增）
- [ ] 实现 `skill_pending_deploy_count` 指标采集（新增）
- [ ] 实现 `venv_total_count`、`venv_disk_usage_bytes` 等已有指标
- [ ] 实现 `dependency_install_duration_seconds` 指标采集
- [ ] 实现 `dependency_install_failure_rate` 指标采集
- [ ] 实现 `runtime_lock_duration_seconds` 指标采集
- [ ] 实现 `skill_execution_duration_seconds` 指标采集
- [ ] 配置监控告警规则

### Phase 9: 删除与版本管理场景（P1）

- [ ] Skill 删除流程：不卸载依赖的实现
- [ ] 用户删除所有 Skill 检测：保留 venv，等待空闲清理
- [ ] 用户账户删除流程：级联清理环境、Skill 和依赖快照
- [ ] Skill 版本回滚流程：依赖不回滚的实现
- [ ] 版本回滚兼容性检查：提供警告提示
- [ ] 审计日志：记录删除、清理和回滚操作

### Phase 10: 测试和文档（P1）

- [ ] 单元测试：虚拟环境管理
- [ ] 单元测试：脚本安全扫描
- [ ] 单元测试：部署流程（含回滚）
- [ ] 单元测试：部署状态流转
- [ ] 单元测试：依赖冲突检测
- [ ] 单元测试：升级影响预检
- [ ] 单元测试：依赖恢复逻辑
- [ ] 集成测试：完整上传 → 部署 → 执行流程
- [ ] 集成测试：部署失败 → 重试流程
- [ ] 集成测试：删除清理流程
- [ ] 集成测试：版本回滚流程
- [ ] 集成测试：依赖快照保存与恢复
- [ ] 用户文档：部署与执行指南
- [ ] 用户文档：安全审查说明
- [ ] 用户文档：版本回滚与依赖处理说明


---

**导航**： [← 错误处理](./10-error-handling.md) | [返回目录](./00-index.md) | [安全考虑 →](./12-security.md)
