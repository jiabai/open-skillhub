# Content Hash Dedup — Task Checklist

## Phase 1: 后端数据模型和 hash 计算

- [x] **T1.1** 新增 Alembic 迁移：`skill_versions` 表加 `content_hash VARCHAR(64) NOT NULL DEFAULT ""`
  - 文件：`backend/db/migrations/versions/`
  - 验证：`uv run alembic -c backend/alembic.ini upgrade head` 成功

- [x] **T1.2** 更新 `SkillVersion` 模型，新增 `content_hash` 字段
  - 文件：`backend/models/skill_version.py`
  - 验证：`uv run mypy backend` 类型检查通过（或与基线一致）

- [x] **T1.3** 实现 `compute_skill_content_hash()` 工具函数
  - 文件：优先新建 `backend/core/utils/skill_hash.py`
  - 包含：SHA-256、POSIX 相对路径排序、排除 `.DS_Store`、`Thumbs.db`、`__MACOSX/`
  - 注意：不要统一排除一般 dotfile；只要会被分发就参与 hash
  - 验证：单元测试覆盖空目录、单文件、多文件、排序、排除规则、dotfile 参与计算

- [x] **T1.4** 更新 `SkillVersionRepository.create_version()`
  - 文件：`backend/repositories/skill_version.py`
  - 变更：新增 `content_hash: str = ""` 参数并写入模型
  - 验证：现有直接创建 `SkillVersion` 或调用 repository 的测试仍可运行

- [x] **T1.5** 在 `SkillUploadCoordinator` 版本创建路径中调用 hash 计算
  - 文件：`backend/services/skill_upload.py`
  - 位置：`upload_zip_create_skill_from_path()` 和 `upload_zip_from_path()` 中版本目录写入后、创建版本记录前
  - 验证：上传后数据库记录包含非空 `content_hash`

- [x] **T1.6** 在 `sync_public_skills.py` 版本创建/补录路径中调用 hash 计算
  - 文件：`backend/scripts/sync_public_skills.py`
  - 位置：`_ensure_version_record()` 和 `_create_snapshot_version()` 相关路径
  - 约束：不改变全量同步、单项导入、缺失失活、自动快照版本递增语义
  - 验证：`tests/test_sync_public_skills.py` 覆盖新建版本、补录既有 `_versions` 子目录时 `content_hash` 非空

- [x] **T1.7** 编写回填脚本 `backend/scripts/backfill_content_hash.py`
  - 功能：遍历所有 `content_hash` 为空的 `skill_versions` 记录，定位版本目录，计算并更新
  - 目录定位：优先使用 skill 记录的 `skill_dir`，否则回退到用户 skill versions 目录约定
  - 验证：在测试环境运行，确认所有可定位记录的 `content_hash` 非空；无法定位的记录有明确日志

- [x] **T1.8** 后端 Phase 1 测试
  - 验证：
    - `uv run pytest tests/test_sync_public_skills.py -v`
    - `uv run pytest` 全量通过

## Phase 2: 后端客户端 API 返回 content_hash

- [x] **T2.1** `ClientSkillSummaryResponse` 顶层增加 `content_hash` 字段
  - 文件：`backend/schemas/client_skill.py`
  - 类型：`str | None = None`
  - 约束：不要把 `content_hash` 加到共享的 `SkillVersionResponse`

- [x] **T2.2** `ClientSkillCatalogService` 填充 `content_hash` 值
  - 文件：`backend/services/client_skill_catalog.py`
  - 逻辑：取 skill 当前版本的 `content_hash`，空字符串映射为 `None`

- [x] **T2.3** 更新客户端 API 测试
  - 文件：`tests/test_client_skills_api.py`
  - 验证：`GET /api/v1/client/skills` 响应包含顶层 `content_hash` 字段
  - 验证：版本相关 Web API 响应不新增 `content_hash`

- [x] **T2.4** 后端 Phase 2 测试
  - 验证：
    - `uv run pytest tests/test_client_skills_api.py -v`
    - `uv run pytest tests/test_api_skills.py -v`

## Phase 3: 桌面客户端类型和比较逻辑

- [x] **T3.1** 更新远端 skill 摘要归一化
  - 文件：`desktop-client/electron/main.ts`
  - 变更：从 API 的 `content_hash` / `contentHash` / `latest_version.content_hash` 读取并映射为 `RemoteSkillSummary.contentHash`
  - 验证：补充或更新 electron main 相关测试；若无现有覆盖，至少通过客户端测试和构建验证

- [x] **T3.2** 更新 State DB schema 并兼容旧库
  - 文件：`desktop-client/src/core/storage/state-db.ts`
  - 变更：
    - `distributed_skills` 增加 `installed_content_hash`、`remote_content_hash`
    - `pending_updates` 增加 `local_content_hash`、`remote_content_hash`
    - 启动时检查列集合，缺失列执行 `ALTER TABLE ... ADD COLUMN ...`
    - 旧 reason 值映射：`missing-local-record` → `not-installed`，`version-mismatch` → `update`
  - 验证：新增旧 schema 读取/写回测试

- [x] **T3.3** 更新类型定义
  - 文件：`desktop-client/src/types/index.ts`
  - 变更：
    - `RemoteSkillSummary` 增加 `contentHash: string | null`
    - `LocalDistributedSkillRecord` 增加 `installedContentHash: string | null`、`remoteContentHash: string | null`
    - `PendingSyncUpdate` 增加 `localContentHash: string | null`、`remoteContentHash: string | null`
    - `PendingSyncUpdate.reason` 类型改为 `"not-installed" | "update"`
    - `SyncComparisonItem` 增加 local/remote content hash 字段，`status` 改为 `"installed" | "not-installed" | "update"`
    - `SkillDistributionRequest` 增加 `contentHash: string | null`
    - `AgentPreDistributionCheckResult` 增加 `installedContentHash`、`remoteContentHash`，并用 `contentComparison` 替换 `versionComparison`

- [x] **T3.4** 重写 `compareRemoteSkills()`
  - 文件：`desktop-client/src/core/sync/compare.ts`
  - 逻辑：基于 `contentHash` 比较，替代 `version` 字符串比较
  - 兼容：远端 hash 缺失且有本地记录时按 `installed`；无本地记录且远端版本可下载时按 `not-installed`
  - 验证：更新 `desktop-client/src/__tests__/compare.test.ts`

- [x] **T3.5** 更新分发服务状态写回和跳过语义
  - 文件：`desktop-client/src/core/distribution/distribution-service.ts`
  - 变更：
    - 分发成功后记录 `installedContentHash` 和 `remoteContentHash`
    - `skip-same-version` / `skipped-same-version` 改为 `skip-installed-content` / `skipped-installed-content`
  - 验证：更新 `desktop-client/src/__tests__/distribution-service.test.ts`

- [x] **T3.6** 扩展 agent adapter 读取本地 content hash
  - 文件：`desktop-client/src/adapters/agents/base.ts`
  - 变更：`readInstalledSkillMetadata()` 返回已安装目录的 `contentHash`
  - 规则：与后端 hash 规则保持一致，排除 `.DS_Store`、`Thumbs.db`、`__MACOSX/`，不统一排除一般 dotfile
  - 验证：更新 `desktop-client/src/__tests__/agent-adapters.test.ts`

- [x] **T3.7** 更新 pre-distribution check
  - 文件：`desktop-client/src/core/pre-distribution-check/pre-distribution-check-service.ts`
  - 变更：
    - `versionComparison` 替换为 `contentComparison`
    - 状态值为 `"not-installed" | "installed" | "update" | "error"`
    - 版本号字段保留为展示/排障信息，不参与状态判定
  - 验证：更新 `desktop-client/src/__tests__/pre-distribution-check-service.test.ts`

- [x] **T3.8** 更新 UI、Electron 主进程和 i18n 文案
  - 文件：`desktop-client/src/components/`、`desktop-client/src/app/App.tsx`、`desktop-client/electron/main.ts`、`desktop-client/src/i18n/`
  - 变更：
    - 移除版本号对比显示（`v1.0.0 -> v1.0.1`）
    - 改为三态标签：已安装 / 未安装 / 可更新
    - 移除降级警告相关 UI
    - 将所有 `versionComparison === "same"` 判断改为 `contentComparison === "installed"`

- [x] **T3.9** 更新 local skill inventory 受影响类型
  - 文件：`desktop-client/src/core/local-skills/local-skill-inventory-service.ts`
  - 变更：保留 `localVersion` 用于展示和上传元数据；不要把 version 用作同步判定依据
  - 验证：现有 local inventory 测试通过，必要时补充 content hash 字段兼容断言

- [x] **T3.10** 客户端 Phase 3 测试
  - 验证：
    - `cd desktop-client && npm test`
    - `cd desktop-client && npm run build`

## Phase 4: 全量验证

- [x] **T4.1** 后端全量测试
  - `uv run pytest`
  - `uv run ruff check .`
  - `uv run mypy backend`
  - 结果：pytest/ruff 通过；mypy 已运行但命中既有基线类型债，详见 ExecPlan Validation notes

- [x] **T4.2** 客户端全量测试
  - `cd desktop-client && npm test`
  - `cd desktop-client && npm run build`

- [x] **T4.3** 文档验证
  - `python scripts/validate_agents_docs.py --level ERROR`

- [x] **T4.4** 回填脚本验证
  - 在测试环境验证 `backend/scripts/backfill_content_hash.py` 的回填逻辑；真实持久化库 CLI 运行留作部署/运维步骤
  - 确认所有可定位的 `skill_versions` 记录的 `content_hash` 非空
  - 无法定位的历史记录有明确日志和残余风险说明
  - 结果：通过 `tests/test_backfill_content_hash.py` 的隔离测试库覆盖；未对本机持久化数据库运行 CLI，避免修改本地数据

## 依赖关系

```
T1.1 -> T1.2 -> T1.3 -> T1.4 -> T1.5, T1.6 -> T1.8
T1.3 -> T1.7
T1.8 -> T2.1 -> T2.2 -> T2.3 -> T2.4
T2.4 -> T3.1 -> T3.2 -> T3.3 -> T3.4, T3.5, T3.6, T3.7, T3.8, T3.9 -> T3.10
T3.10 -> T4.1, T4.2, T4.3, T4.4
```

Phase 1 和 Phase 2 是后端改动，Phase 3 是客户端改动，Phase 4 是全量验证。后端客户端 API 变更完成后客户端才能开始。
