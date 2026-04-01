---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 实施计划

### Phase 1: 数据模型和基础设施（P0）

- [ ] 数据库迁移：添加 `users` 表新字段（包括运行时锁字段）
- [ ] 配置项：添加运行时相关配置
- [ ] 工具函数：虚拟环境创建、依赖解析

### Phase 2: 安全扫描机制（P0）

- [ ] 风险模式定义：HIGH/MEDIUM/LOW 级别模式列表
- [ ] 脚本扫描服务：`ScriptScanner` 类实现
- [ ] 上传流程集成：在 ZIP 解压后执行扫描
- [ ] 前端安全审查对话框：高风险拒绝、中风险确认

### Phase 3: 上传流程改造（P0）

- [ ] 修改 `SkillService.upload_zip`：集成环境创建和依赖安装
- [ ] 集成运行时锁机制：加锁/解锁逻辑
- [ ] SKILL.md metadata 解析：提取 `script_entry` 设置 `script_file` 字段
- [ ] 首次上传时设置 `skill_storage_path`：确保级联删除可用
- [ ] 环境已存在时更新 `venv_last_used_at`：避免空闲误判
- [ ] 临时文件清理：上传完成/失败后清理临时目录
- [ ] 新增冲突检测 API
- [ ] 新增冲突解决 API
- [ ] 新增依赖预览 API：返回 `dependency_preview` 状态
- [ ] 新增依赖确认 API：`POST /skills/upload/confirm-dependencies`
- [ ] 新增安装进度查询 API：`GET /skills/upload/{uuid}/progress`
- [ ] 前端依赖预览对话框组件
- [ ] 前端安装进度组件（轮询方式）
- [ ] 前端错误详情组件
- [ ] 前端冲突对话框组件

### Phase 4: 执行流程改造（P0）

- [ ] 修改 `ExecuteSkillOp`：使用用户虚拟环境
- [ ] 环境变量清理：`build_safe_environment` 函数
- [ ] 运行时锁检查：执行前检查 `runtime_locked`
- [ ] 更新使用时间戳
- [ ] 使用 `skill.script_file` 字段确定脚本入口文件

### Phase 5: 管理功能（P1）

- [ ] 管理接口：查询用户环境状态
- [ ] 管理接口：清理用户环境
- [ ] 管理接口：清理未使用依赖（含 dry_run 模式）
- [ ] 定时任务：自动清理空闲环境（含 Skill 数量检查）
- [ ] 定时任务：清理超时的运行时锁（区分等待确认和安装中状态）
- [ ] 前端：依赖管理页面（显示未使用依赖）

### Phase 5.5: 监控指标（P1）

- [ ] 实现 `venv_total_count` 指标采集
- [ ] 实现 `venv_disk_usage_bytes` 指标采集
- [ ] 实现 `venv_creation_duration_seconds` 指标采集
- [ ] 实现 `dependency_install_duration_seconds` 指标采集
- [ ] 实现 `dependency_install_failure_rate` 指标采集
- [ ] 实现 `runtime_lock_duration_seconds` 指标采集
- [ ] 实现 `runtime_lock_timeout_count` 指标采集
- [ ] 实现 `script_scan_high_risk_count` 指标采集
- [ ] 实现 `skill_rollback_count` 和 `rollback_compatibility_warning_rate` 指标采集
- [ ] 实现 `cascade_cleanup_duration_seconds` 指标采集
- [ ] 配置监控告警规则（磁盘占用、安装失败率、锁超时等）

### Phase 6: 删除与版本管理场景（P1）

- [ ] Skill 删除流程：不卸载依赖的实现
- [ ] 用户删除所有 Skill 检测：保留 `venv_last_used_at` 不变（等待空闲清理）
- [ ] 用户账户删除流程：级联清理环境和 Skill
- [ ] Skill 版本回滚流程：依赖不回滚的实现
- [ ] 版本回滚兼容性检查：提供警告提示
- [ ] 审计日志：记录删除、清理和回滚操作

### Phase 7: 测试和文档（P1）

- [ ] 单元测试：虚拟环境管理
- [ ] 单元测试：依赖冲突检测
- [ ] 单元测试：脚本安全扫描
- [ ] 单元测试：Skill 删除流程
- [ ] 单元测试：账户删除级联清理
- [ ] 单元测试：Skill 版本回滚
- [ ] 集成测试：完整上传执行流程
- [ ] 集成测试：完整删除清理流程
- [ ] 集成测试：版本回滚流程
- [ ] 用户文档：依赖管理指南
- [ ] 用户文档：安全审查说明
- [ ] 用户文档：Skill 删除与环境清理说明
- [ ] 用户文档：版本回滚与依赖处理说明


---

**导航**： [← 错误处理](./10-error-handling.md) | [返回目录](./00-index.md) | [安全考虑 →](./12-security.md)