# Skill 内容指纹去重 — 设计文档

## 这份文档解决什么问题

SKILL.md 的 `version` 字段不是强制的，大多数 skill 作者不填写。后端自动生成的版本号是伪信息，基于版本号字符串比较的分发状态判定不可靠，导致重复分发和 `unknown` 状态。

本文档定义内容指纹（Content Hash）的计算规范、存储方式、API 变更和客户端状态模型，作为实现时的持久设计参考。

## 先看怎么用

对 skill 作者和 Web 控制台用户来说，行为不变。版本号仍然存在，上传时仍然自动 bump。

对桌面客户端来说，分发状态判定从版本号字符串比较改为 content hash 比较：

```
# 之前
localVersion === remoteVersion → in-sync
localVersion !== remoteVersion → update
localVersion === null → install

# 之后
无可下载远端版本 → installed（无操作）
无本地记录 → not-installed
远端 content hash 缺失 且 有本地记录 → installed（兼容回填窗口）
本地 content hash 缺失 → update
localContentHash === remoteContentHash → installed
localContentHash !== remoteContentHash → update
```

## Content Hash 计算规范

### 算法

SHA-256，输出 64 字符十六进制字符串。

### 输入

对 skill 版本目录下所有有效文件，按相对路径排序后依次输入哈希：

```
hasher = SHA-256()
for (relative_path, content) in sorted(entries):
    hasher.update(relative_path + "\0")
    hasher.update(content)
    hasher.update("\0")
return hasher.hexdigest()
```

### 有效文件定义

遍历版本目录下所有文件，排除以下内容：

| 排除项 | 原因 |
|--------|------|
| `.DS_Store` | macOS 系统文件 |
| `Thumbs.db` | Windows 系统文件 |
| `__MACOSX/` 目录下所有文件 | macOS ZIP 解压产物 |

一般 dotfile（例如 `.env.example`、`.config/` 下的文件）不被统一排除。只要它们会被分发到客户端，就应参与 content hash；否则隐藏文件变化会被错误地忽略。

### 确定性保证

- 相对路径统一使用 POSIX 格式（`/` 分隔符）
- 文件按相对路径字典序排列
- 不依赖文件系统遍历顺序
- 不包含文件权限、修改时间等元数据
- `SKILL.md` 以原始文件内容参与计算。后端数据库里的自动版本号变化不会影响 hash；如果作者手动修改 `SKILL.md` 文件内容，则按真实分发内容变化处理。
- 调用方传入的目录必须是具体版本目录或已安装 skill 根目录，不能是包含 `_versions/` 的父目录。

### 实现参考

```python
import hashlib
from pathlib import Path

EXCLUDED_NAMES = {".DS_Store", "Thumbs.db"}

def compute_skill_content_hash(version_dir: Path) -> str:
    entries: list[tuple[str, bytes]] = []
    for file_path in version_dir.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.name in EXCLUDED_NAMES:
            continue
        if "__MACOSX" in file_path.parts:
            continue
        relative = file_path.relative_to(version_dir).as_posix()
        content = file_path.read_bytes()
        entries.append((relative, content))

    entries.sort(key=lambda e: e[0])

    hasher = hashlib.sha256()
    for relative, content in entries:
        hasher.update(f"{relative}\0".encode("utf-8"))
        hasher.update(content)
        hasher.update(b"\0")

    return hasher.hexdigest()
```

## 数据模型变更

### `skill_versions` 表

新增字段：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `content_hash` | `VARCHAR(64)` | `NOT NULL DEFAULT ""` | 版本内容的 SHA-256 哈希 |

设计决策：使用空字符串而非 `NULL` 作为默认值，与现有字段的 NOT NULL 惯例保持一致。空字符串表示"尚未计算"，客户端按 `null` 处理。

`SkillVersionRepository.create_version()` 增加 `content_hash: str = ""` 参数。所有创建版本的生产路径都应传入真实 hash；默认值只用于迁移窗口和测试兼容。

### Alembic 迁移

```python
def upgrade() -> None:
    op.add_column("skill_versions", sa.Column("content_hash", sa.String(64), nullable=False, server_default=""))

def downgrade() -> None:
    op.drop_column("skill_versions", "content_hash")
```

## API 变更

### `GET /api/v1/client/skills` 响应

`ClientSkillSummaryResponse` 新增字段：

```python
content_hash: str | None = None
```

取值逻辑：
- skill 有当前版本且 `content_hash` 非空 → 返回哈希值
- skill 有当前版本但 `content_hash` 为空（未回填） → 返回 `null`
- skill 无当前版本 → 返回 `null`

### 其他 API

Web 控制台 API（`/api/v1/skills/`）不返回 `content_hash`，该字段仅面向客户端分发场景。因此本轮不把 `content_hash` 加到共享的 `SkillVersionResponse`，避免版本列表、版本详情、回滚等 Web 控制台接口被动改变响应体。

## 客户端状态模型

### 三态模型

| 状态 | 判定条件 | UI 标签 | 分发按钮 |
|------|---------|---------|---------|
| `installed` | 有本地记录且 hash 相同；或远端 hash 暂缺但已有本地记录；或远端无可下载版本 | 已安装 | 隐藏 |
| `not-installed` | 无本地记录且远端有可下载版本 | 未安装 | 显示 |
| `update` | 有本地记录、远端 hash 已知，且本地 hash 缺失或不相等 | 可更新 | 显示 |

### 移除的状态

| 旧状态 | 原判定条件 | 移除原因 |
|--------|-----------|---------|
| `in-sync` | `localVersion === remoteVersion` | 被 `installed` 替代，改用 hash 判定 |
| `unknown` | 本地无版本信息 | hash 判定消除了此状态 |
| `installed-newer` | 本地版本号更高 | 版本号不可靠，降级警告无意义 |
| `installed-older` | 本地版本号更低 | 被 `update` 替代 |
| `same` | 版本号相同 | 被 `installed` 替代 |

### `compareRemoteSkills()` 逻辑变更

```typescript
// 之前
if (remoteVersion === null) → status = "in-sync"
else if (localVersion === null) → status = "install"
else if (localVersion !== remoteVersion) → status = "update"
else → status = "in-sync"

// 之后
if (remoteVersion === null) → status = "installed"
else if (localRecord === null) → status = "not-installed"
else if (remoteContentHash === null) → status = "installed"
else if (localContentHash === null) → status = "update"
else if (localContentHash !== remoteContentHash) → status = "update"
else → status = "installed"
```

兼容规则说明：
- 远端无可下载版本时不创建 pending update，保持现有"不可下载则无操作"行为。
- 远端 hash 暂缺且已有本地记录时不创建 update，避免回填窗口造成重复分发。
- 旧 State DB 的本地记录缺失 `installedContentHash` 时，如果远端 hash 已知，则创建 `update`，由 pre-distribution check 读取实际本地目录 hash 后允许用户跳过或校准状态。

### 类型变更

```typescript
// RemoteSkillSummary
interface RemoteSkillSummary {
  id: string
  name: string
  version: string | null
  contentHash: string | null        // 新增
  updatedAt: string
}

// LocalDistributedSkillRecord
interface LocalDistributedSkillRecord {
  remoteSkillId: string
  name: string
  installedVersion: string | null
  installedContentHash: string | null  // 新增
  remoteVersion: string | null
  remoteContentHash: string | null     // 新增
  lastComparedAt: string | null
}

// PendingSyncUpdate
interface PendingSyncUpdate {
  remoteSkillId: string
  name: string
  localVersion: string | null
  localContentHash: string | null      // 新增
  remoteVersion: string
  remoteContentHash: string | null     // 新增
  reason: "not-installed" | "update"   // 从 "missing-local-record" | "version-mismatch" 改为
}

// SyncComparisonItem.status
type SyncComparisonStatus = "installed" | "not-installed" | "update"
// 旧值: "in-sync" | "install" | "update"

// SkillDistributionRequest
interface SkillDistributionRequest {
  skillId: string
  name: string
  version: string | null
  contentHash: string | null       // 新增，来自 pending update 的 remoteContentHash
  packageSource: unknown
}
```

桌面客户端从后端读取时仍接收 snake_case JSON 字段：`content_hash`。`desktop-client/electron/main.ts` 的归一化层负责映射为 `contentHash`。

### State DB 兼容迁移

`distributed_skills` 增加：

- `installed_content_hash TEXT`
- `remote_content_hash TEXT`

`pending_updates` 增加：

- `local_content_hash TEXT`
- `remote_content_hash TEXT`

现有 SQLite 文件只通过 `CREATE TABLE IF NOT EXISTS` 不会获得新列，因此启动时必须检查列集合并对缺失列执行 `ALTER TABLE ... ADD COLUMN ...`。读取旧记录时缺失 hash 统一映射为 `null`，旧 reason 值映射为新 reason：

- `missing-local-record` → `not-installed`
- `version-mismatch` → `update`

### Pre-distribution check 简化

预分发检查不再比较版本号。`AgentAdapterV1.readInstalledSkillMetadata()` 返回已安装目录的 `contentHash`，`AgentPreDistributionCheckResult` 将 `versionComparison` 替换为 `contentComparison`：

```typescript
// 之前
type VersionComparison = "not-installed" | "installed-newer" | "installed-older" | "same" | "unknown" | "error"

// 之后
type ContentComparison = "not-installed" | "installed" | "update" | "error"
```

`error` 保留为读取失败时的特殊状态。它不是同步三态模型的一部分，只表示本次本地目录检查失败。

预分发检查判定：

```typescript
if (!exists) → "not-installed"
else if (remoteContentHash === null) → "installed"
else if (installedContentHash === remoteContentHash) → "installed"
else → "update"
```

版本字段可以继续保留在结果里作为展示或排障信息，但不参与状态判定，不再显示降级/升级版本号警告。

### 分发成功后记录

`updateStateAfterSuccessfulDistribution()` 中增加：

```typescript
installedContentHash: request.contentHash
remoteContentHash: request.contentHash
```

如果预分发检查发现所有目标都已经是相同 content hash，分发写入模式从旧的 `skip-same-version` 改为 `skip-installed-content`，对应目标结果从 `skipped-same-version` 改为 `skipped-installed-content`。

## 数据回填

已有 skill 版本的 `content_hash` 字段默认为空字符串。需要一次性回填：

1. 遍历所有 `skill_versions` 记录
2. 定位对应的版本目录
3. 计算 content hash
4. 更新数据库记录

回填期间服务正常运行。空字符串的 `content_hash` 在客户端 API 中映射为 `null`。客户端兼容规则为：

- 已有本地记录时按 `installed` 处理，避免回填窗口造成重复分发。
- 无本地记录但远端版本可下载时按 `not-installed` 处理，允许首次安装。

回填脚本放置在 `backend/scripts/backfill_content_hash.py`。

## 不做什么

- 不改变版本号的生成和 bump 逻辑
- 不强制要求 SKILL.md 填写 version
- 不实现上传去重
- 不在分发包中注入 version 或附加 manifest.json
- 不改变 Web 控制台的行为
- 不改变 `sync_public_skills.py` 的全量同步、单项导入、失活、自动快照版本递增语义；只补充版本记录的 content hash 写入
- 不改变 `skill_versions` 的 UniqueConstraint
- 不把 `content_hash` 加到共享的 `SkillVersionResponse`

## 稳定约定

- Content hash 算法为 SHA-256，不使用其他算法
- 有效文件排除规则如上所述，后续如需调整需更新本文档
- 三态模型是客户端同步状态的完整集合，不引入第四种状态
- Pre-distribution check 的 `error` 是检查失败状态，不属于同步三态模型
- `content_hash` 为空字符串时等同于"未计算"，客户端统一按 `null` 处理
- 版本号保留但仅用于排序和追溯，不作为分发判断依据

## 什么时候需要回来看这份文档

- 如果要更换哈希算法
- 如果要调整有效文件排除规则
- 如果要引入上传去重（内容相同时跳过创建新版本）
- 如果要在 Web 控制台展示 content hash
- 如果要在分发包中附带 hash 信息
