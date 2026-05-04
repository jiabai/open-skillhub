# Content Hash Dedup ExecPlan

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

Skill 版本号不是强制的，大多数 skill 不写 version，后端自动生成的版本号是伪信息。
基于版本号字符串比较的分发状态判定不可靠，导致内容未变时重复分发，以及本地 SKILL.md
无 version 时显示 `unknown`。

引入 content hash（SHA-256）替代版本号作为分发状态判定依据，将同步状态简化为
`installed` / `not-installed` / `update` 三态模型。

Implementation proceeded after spec and plan review approval on 2026-05-04.

## Progress

- [x] (2026-05-04) 分析了当前 skill 版本体系、上传逻辑、客户端 sync 比较逻辑、pre-distribution check 状态模型。
- [x] (2026-05-04) 确认了方案选择：Content Hash 去重，三态模型。
- [x] (2026-05-04) 创建了产品规格 `docs/product-specs/2026-05-04-content-hash-dedup.md`。
- [x] (2026-05-04) 创建了设计文档 `docs/design-docs/content-hash-dedup.md`。
- [x] (2026-05-04) 创建了本执行计划和任务清单。
- [x] (2026-05-04) 审查并修正了 spec/design/plan/task 之间的口径：API 只在客户端摘要暴露 hash，公共 skill 同步只补 hash 不改语义，桌面端补充 State DB 兼容迁移和本地目录 hash 检查。
- [x] (2026-05-04) 完成后端 Phase 1/2：新增 `skill_versions.content_hash`、后端 hash 工具、上传与公共同步写 hash、回填脚本、客户端 API 顶层 `content_hash`。
- [x] (2026-05-04) 完成桌面端 Phase 3：远端摘要映射 `contentHash`、State DB 兼容迁移、content hash 同步比较、分发写回/跳过语义、本地目录 hash、`contentComparison` 预检查、UI/i18n 三态文案。
- [x] (2026-05-04) 完成 Phase 4 验证：后端/桌面端全量测试、构建、ruff、mypy、文档校验已执行并通过。

## Surprises & Discoveries

- 设计文档原本一边要求 Web 控制台 API 不返回 `content_hash`，一边又计划修改共享的 `SkillVersionResponse`。这会被动改变版本列表、版本详情和回滚响应，已改为只在 `ClientSkillSummaryResponse` 顶层返回 `content_hash`。
- `sync_public_skills.py` 原本被列为"不改变逻辑"，但任务清单又要求写入 hash。已澄清为不同步语义不变，只在版本记录创建/补录时计算并保存 hash。
- 远端 `content_hash` 为空时的客户端行为原本前后冲突。已明确：已有本地记录时按 `installed` 兼容回填窗口；无本地记录且远端版本可下载时仍按 `not-installed`。
- 桌面 State DB 当前只有 `CREATE TABLE IF NOT EXISTS`，新增列需要显式 `ALTER TABLE` 兼容迁移，否则旧库不会获得 hash 字段。
- 预分发检查要真正消除 `unknown`，必须由 agent adapter 读取已安装目录并计算本地 content hash；仅简化 enum 值不够。

## Decision Log

- Decision: 使用 SHA-256 作为 content hash 算法。
  Rationale: 业界标准，碰撞概率可忽略，计算速度足够。
  Date: 2026-05-04

- Decision: 排除系统/打包噪声文件（`.DS_Store`、`Thumbs.db`、`__MACOSX/`）。
  Rationale: 这些文件不属于 skill 内容，不同环境可能产生不同结果。
  Date: 2026-05-04

- Decision: 不统一排除一般 dotfile，只排除 `.DS_Store`、`Thumbs.db`、`__MACOSX/` 等系统/打包噪声。
  Rationale: dotfile 如果会被分发到客户端，就是 skill 内容；排除它们会漏判真实内容变化。
  Date: 2026-05-04

- Decision: `content_hash` 字段使用空字符串默认值而非 NULL。
  Rationale: 与现有 `skill_versions` 表的 NOT NULL 惯例一致。
  Date: 2026-05-04

- Decision: 不实现上传去重。
  Rationale: 上传去重改变了"上传必创建新版本"的语义，增加了边界情况处理复杂度。本轮只解决分发端的问题。
  Date: 2026-05-04

- Decision: 不在分发包中注入 version 或附加 manifest.json。
  Rationale: 增加打包复杂度和客户端读取逻辑。本轮通过本地目录 content hash 解决分发判断和 `unknown` 显示问题。
  Date: 2026-05-04

- Decision: `PendingSyncUpdate.reason` 从 `"missing-local-record" | "version-mismatch"` 改为 `"not-installed" | "update"`。
  Rationale: 与三态模型对齐，语义更清晰。
  Date: 2026-05-04

- Decision: 不把 `content_hash` 加到共享 `SkillVersionResponse`，只加到 `ClientSkillSummaryResponse` 顶层。
  Rationale: `SkillVersionResponse` 被 Web 控制台版本 API 复用；本轮明确不改变 Web 控制台 API 行为。
  Date: 2026-05-04

- Decision: 将 pre-distribution check 的 `versionComparison` 替换为 `contentComparison`。
  Rationale: 继续使用 version 命名会把新的 hash 判定模型和旧版本号比较混在一起。
  Date: 2026-05-04

- Decision: 桌面 State DB 需要就地兼容迁移新增 hash 列。
  Rationale: 旧 SQLite 文件不会因为 `CREATE TABLE IF NOT EXISTS` 自动新增列，必须显式处理。
  Date: 2026-05-04

- Decision: 远端 `content_hash` 为空且已有本地记录时按 `installed` 处理。
  Rationale: 这是回填窗口的兼容策略，可避免一次性重复分发；无本地记录且远端版本可下载时仍显示 `not-installed` 允许首次安装。
  Date: 2026-05-04

## Outcomes & Retrospective

Validation notes:

- Passed (2026-05-04): `python scripts/validate_agents_docs.py --level ERROR`，0 errors, 0 warnings。
- Passed (2026-05-04): `uv run pytest tests/test_skill_content_hash.py tests/test_backfill_content_hash.py tests/test_sync_public_skills.py tests/test_client_skills_api.py -q`，24 passed。
- Passed (2026-05-04): `uv run python -m alembic -c backend/alembic.ini upgrade head`。`uv run alembic ...` 在当前 Windows 环境触发 `uv trampoline failed to canonicalize script path`，因此使用等价模块形式验证迁移。
- Passed (2026-05-04): `cd desktop-client && npm test -- src/__tests__/compare.test.ts src/__tests__/sync-service.test.ts src/__tests__/state-db.test.ts src/__tests__/pre-distribution-check-service.test.ts src/__tests__/distribution-service.test.ts src/__tests__/local-skill-inventory-service.test.ts src/__tests__/app.test.tsx`，40 passed。
- Passed (2026-05-04): `cd desktop-client && npm test`，108 passed。
- Passed (2026-05-04): `cd desktop-client && npm run build`，Electron typecheck、renderer build、main/preload build 全部成功。
- Passed (2026-05-04): `uv run pytest`，635 passed。
- Passed (2026-05-04): `uv run ruff check .`，All checks passed。
- Passed (2026-05-04): `python scripts/validate_agents_docs.py --level ERROR`，0 errors, 0 warnings。
- Passed (2026-05-04): `uv run mypy backend`，Success: no issues found in 140 source files。此前 Python 3.10 目标版本导致 `StrEnum` / `SkillErrorCode` 级联错误；切换到 Python 3.13 后剩余 14 个既有类型标注问题已修复。
- Backfill validation (2026-05-04): `tests/test_backfill_content_hash.py` 在隔离测试库中验证可定位版本目录会写入非空 `content_hash`；未对本机持久化数据库运行 CLI，避免修改本地数据。

## Context and Orientation

### Current state

| Path | Why it matters |
|------|----------------|
| `backend/models/skill_version.py` | `SkillVersion` 模型，需新增 `content_hash` 字段 |
| `backend/repositories/skill_version.py` | `create_version()` 需接收 `content_hash`，兼容默认空字符串 |
| `backend/services/skill_upload.py` | 版本创建入口，需在创建时计算 hash |
| `backend/scripts/sync_public_skills.py` | 公共 skill 版本创建/补录路径需填充 hash，语义不变 |
| `backend/services/client_skill_catalog.py` | 客户端 skill 列表服务，需返回 `content_hash` |
| `backend/schemas/client_skill.py` | 客户端 API 响应 schema，需新增字段 |
| `desktop-client/electron/main.ts` | 远端 skill 摘要归一化，需映射 `content_hash` |
| `desktop-client/src/core/sync/compare.ts` | `compareRemoteSkills()` 核心比较逻辑 |
| `desktop-client/src/core/storage/state-db.ts` | SQLite 状态库需新增 hash 列并兼容旧库 |
| `desktop-client/src/core/distribution/distribution-service.ts` | 分发成功后状态更新逻辑 |
| `desktop-client/src/adapters/agents/base.ts` | 读取已安装 skill 元数据时计算本地 content hash |
| `desktop-client/src/core/pre-distribution-check/pre-distribution-check-service.ts` | pre-distribution check 状态判定 |
| `desktop-client/src/types/index.ts` | 类型定义 |

### Related docs

- `docs/product-specs/2026-05-04-content-hash-dedup.md`
- `docs/design-docs/content-hash-dedup.md`
- `docs/exec-plans/active/content-hash-dedup-tasks.md`

## Plan of Work

### Phase 1: 后端数据模型和 hash 计算

1. 新增 Alembic 迁移，`skill_versions` 表加 `content_hash` 字段。
2. 实现 `compute_skill_content_hash()` 工具函数。
3. `SkillVersionRepository.create_version()` 接收 `content_hash`，默认空字符串用于兼容。
4. 在 `SkillUploadCoordinator` 的版本创建路径中调用 hash 计算。
5. 在 `sync_public_skills.py` 的版本创建和版本目录补录路径中调用 hash 计算，但不改变同步语义。
6. 编写回填脚本 `backend/scripts/backfill_content_hash.py`。

### Phase 2: 后端 API 返回 content_hash

1. `ClientSkillSummaryResponse` 顶层增加 `content_hash` 字段。
2. `ClientSkillCatalogService` 填充 `content_hash` 值。
3. 确认 `SkillVersionResponse` 不变，避免 Web 控制台 API 被动暴露 hash。
4. 更新客户端 API 测试。

### Phase 3: 桌面客户端类型和比较逻辑

1. 更新 `desktop-client/electron/main.ts`，把 API 的 `content_hash` 映射为 `RemoteSkillSummary.contentHash`。
2. 更新 State DB schema，新增 hash 列并对旧 SQLite 文件执行兼容迁移。
3. 更新 `RemoteSkillSummary`、`LocalDistributedSkillRecord`、`PendingSyncUpdate`、`SyncComparisonItem`、`SkillDistributionRequest` 类型。
4. 重写 `compareRemoteSkills()` 使用 content hash 比较。
5. 更新 `updateStateAfterSuccessfulDistribution()` 记录 hash。
6. 扩展 agent adapter 读取已安装目录 content hash。
7. 将 pre-distribution check 从 `versionComparison` 改为 `contentComparison`。
8. 将 `skip-same-version` / `skipped-same-version` 重命名为 content hash 语义。
9. 更新 UI 状态标签和 i18n 文案。

### Phase 4: 测试和验证

1. 后端单元测试覆盖 hash 计算和 API 返回。
2. 客户端单元测试覆盖新比较逻辑。
3. 运行全量测试套件。
4. 运行回填脚本验证已有数据。

## Concrete Steps

### Step 1: 后端迁移和 hash 计算

```bash
uv run alembic -c backend/alembic.ini revision --autogenerate -m "add content_hash to skill_versions"
uv run alembic -c backend/alembic.ini upgrade head
```

### Step 2: 后端 API 更新

```bash
uv run pytest tests/test_client_skills_api.py -v
```

### Step 3: 客户端逻辑更新

```bash
cd desktop-client && npm test
```

### Step 4: 全量验证

```bash
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
cd desktop-client && npm run build && npm test
```

## Validation and Acceptance

Validation flow:

1. 后端：`uv run pytest` 全量通过。
2. 后端：`uv run ruff check .` 无错误。
3. 后端：`uv run mypy backend` 类型检查通过（或记录基线差异）。
4. 客户端：`npm test` 全量通过。
5. 客户端：`npm run build` 构建成功。
6. 文档：`python scripts/validate_agents_docs.py --level ERROR` 通过。

Acceptance criteria:

- `skill_versions` 表有 `content_hash` 字段。
- 创建新版本时自动计算并存储 content hash。
- 公共 skill 同步创建或补录版本记录时填充 content hash，且不改变原同步语义。
- `GET /api/v1/client/skills` 返回 `content_hash`。
- Web 控制台版本相关 API 响应不新增 `content_hash`。
- 桌面 State DB 旧库可迁移，旧记录 hash 缺失时行为可预期。
- 桌面客户端基于 content hash 判定同步状态。
- 同步状态只有 `installed` / `not-installed` / `update` 三种。
- Pre-distribution check 使用本地目录 hash 输出 `contentComparison`，读取失败时才显示 `error`。
- 内容未变但版本号变更的 skill 不触发重复分发。
- 回填脚本可以补全已有版本的 content hash。
