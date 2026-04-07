# Public Skills + Reference & Clone 设计

## 概述

在不开启 RBAC 的个人私有化场景下，新增公共技能库（Public Skills），支持引用和 Clone 两种使用方式，降低小白用户学习成本，实现"开箱即用"。

## 问题

1. 新用户注册后无任何可用 Skill，需要自己开发或手动上传
2. 当前可见性体系 `private/team/enterprise` 强依赖组织架构，不开启 RBAC 时 `team`/`enterprise` 均为废代码
3. 缺少预制 Skill 的分发机制
4. 用户想要"直接用"和"改代码"两种需求无法同时满足

## 背景分析

### 当前可见性体系的问题

当前 `is_skill_visible` 逻辑（`backend/core/security/rbac.py:53-66`）：

```python
def is_skill_visible(user: User, skill: Skill) -> bool:
    if not settings.ENABLE_SKILL_VISIBILITY:
        return skill.user_id == user.id  # 只能看到自己的
    visibility = (skill.visibility or "private").strip().lower()
    if visibility == "enterprise":
        return bool(user.enterprise_id) and user.enterprise_id == skill.enterprise_id
    if visibility == "team":
        return (bool(user.enterprise_id)
                and user.enterprise_id == skill.enterprise_id
                and bool(user.team_id) and user.team_id == skill.team_id)
    return skill.user_id == user.id
```

不开启 RBAC 时 `user.enterprise_id` 和 `user.team_id` 基本为空，所以 `enterprise`/`team` 这两个级别实际上是废代码。

### 可见性简化方案

| 当前（不合理） | 个人场景（合理） | 含义 |
|---|---|---|
| `private` | `private` | 仅自己可见 |
| `team` | *(去掉)* | 无意义 |
| `enterprise` | *(去掉)* | 无意义 |
| — | `public` | 所有人可见（预制 Skill 用） |

简化后的 `is_skill_visible` 只需判断：

```python
if visibility == "public":
    return True  # 所有人可见
return skill.user_id == user.id  # 否则只看自己的
```

### 存储现状

- `SKILL_STORAGE_PATH` 默认 `/data/skills`
- 用户文件按 `{user_id}/{skill_name}/` 存储
- 版本快照在 `{user_id}/{skill_name}/_versions/{version}/`
- 归档在 `{SKILL_STORAGE_PATH}/_archives/{user_id}/{skill_name}/{version}.zip`
- 文件扩展名白名单：`.md`, `.py`, `.js`, `.ts`, `.sh` 等 33 种
- 限制：单文件 ≤10MB，总大小 ≤100MB，文件数 ≤50

## 解决方案

### 整体架构

```
┌─────────────────────────────────────────────────────┐
│               系统公共空间 (__system__)               │
│                                                     │
│  data/skills/__system__/                            │
│  ├── python-data-analyzer/                          │
│  │   ├── SKILL.md                                   │
│  │   ├── analyzer.py                                │
│  │   └── requirements.txt                           │
│  ├── markdown-to-pdf/                               │
│  └── web-scraper/                                   │
│                                                     │
│  DB: skills.user_id = "system"                      │
│      skills.visibility = "public"                   │
└─────────────────────────────────────────────────────┘
         │                              │
    ┌────┴────┐                    ┌────┴────┐
    │ 引用     │                    │ Clone    │
    │(别名指向) │                    │(完整副本) │
    └────┬────┘                    └────┬────┘
         │                              │
         ▼                              ▼
  DB 记录元数据                 完整复制到用户目录
  执行时读系统目录              用户可完全自由修改
  预制更新自动生效              预制更新不感知
```

## 一、存储方案设计

### 1.1 公共 Skill 存储位置

使用 `__system__` 作为特殊系统用户标识，与真实用户天然隔离：

```
data/skills/
├── __system__/                    ← 预制 Skill (user_id = "system")
│   ├── python-data-analyzer/      ← 目录即 Skill name
│   │   ├── SKILL.md
│   │   ├── analyzer.py
│   │   └── requirements.txt
│   └── markdown-to-pdf/
│       ├── SKILL.md
│       └── converter.js
│
├── {user-uuid-1}/                 ← 真实用户 1
│   └── (自己的 Skills)
│
└── {user-uuid-2}/                 ← 真实用户 2
    └── (自己的 Skills)
```

DB 中的对应记录：

```sql
-- 预制 Skill
INSERT INTO skills (id, user_id, name, description, visibility, skill_dir, ...)
VALUES ('uuid-xxx', 'system', 'python-data-analyzer', '描述', 'public',
        '/data/skills/__system__/python-data-analyzer', ...);
```

**优点**：
- 不与任何真实用户耦合，不用挑一个用户当"预制用户"
- 路径上 `__system__` 语义清晰，一眼看出是系统文件
- `SKILL_STORAGE_PATH` 不需要额外配置开关
- 现有存储工具函数 `get_user_skill_dir("system", name)` 可直接使用

### 1.2 公共 Skill 的文件维护

公共 Skill **不提供 Web 管理界面**。上传到公共空间走运维/开发者路径，用户侧只有浏览、引用、Clone 能力。

公共 Skill 的管理分两种方式：**初始化** 和 **日常运维**。

### 1.3.1 初始化（首次部署）

系统首次部署时，扫描 `data/skills/__system__/` 目录，自动创建缺失的数据库记录：

```python
# backend/scripts/seed_public_skills.py
"""
启动时扫描 __system__ 目录，自动注册公共 Skill。
如果 DB 中已存在同名 Skill，跳过。
"""
import asyncio
from pathlib import Path

from backend.config.settings import settings
from backend.db.session import async_session
from backend.repositories.skill import SkillRepository
from backend.repositories.skill_version import SkillVersionRepository
from backend.services.skill import SkillService

SYSTEM_USER_ID = "system"


async def seed_public_skills():
    """扫描 __system__ 目录，自动创建缺失的公共 Skill 记录。"""
    system_dir = Path(settings.SKILL_STORAGE_PATH) / "__system__"
    if not system_dir.exists():
        return

    async with async_session() as session:

        skill_repo = SkillRepository(session)
        version_repo = SkillVersionRepository(session)

        for skill_dir in sorted(system_dir.iterdir()):
            if not skill_dir.is_dir() or skill_dir.name.startswith("_"):
                continue
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            name = skill_dir.name
            existing = await skill_repo.get_by_user_and_name(SYSTEM_USER_ID, name)
            if existing:
                continue  # 已存在，跳过
            # 从 SKILL.md frontmatter 提取元数据
            content = skill_md.read_text(encoding="utf-8")
            frontmatter = SkillService._parse_frontmatter(content)
            description = frontmatter.get("description", "")
            # 创建 Skill 记录
            skill = await skill_repo.create(
                user_id=SYSTEM_USER_ID,
                name=name,
                description=description,
                visibility="public",
                skill_dir=str(skill_dir),
            )
            # 扫描 _versions 目录或直接以当前目录作为 v1.0.0
            versions_dir = skill_dir / "_versions"
            if versions_dir.exists():
                for v_dir in sorted(versions_dir.iterdir()):
                    if v_dir.is_dir():
                        await version_repo.create_version(
                            skill_id=skill.id,
                            version=v_dir.name,
                            description=description,
                        )
                # 用最新版本号更新 current_version
                # (简化处理：取目录名排序最大者为当前版本)
            else:
                # 当前目录本身就是一个 skill，版本为 1.0.0
                await version_repo.create_version(
                    skill_id=skill.id,
                    version="1.0.0",
                    description=description,
                )
```

在 `backend/api_app.py` 的启动生命周期中调用：

```python
@lifespan
async def lifespan(app):
    # ... 已有的启动逻辑 ...
    from backend.scripts.seed_public_skills import seed_public_skills
    await seed_public_skills()
    # ... 其余启动逻辑 ...
    yield
```

### 1.3.2 日常新增/更新公共 Skill

通过现有 API 上传，新增一个 `target` 参数：

```
POST /api/v1/skills/upload?target=system
Authorization: Bearer <admin-jwt>

Content-Type: multipart/form-data
- file: ZIP 文件
- skill_uuid: 已有公共 Skill UUID（更新时用，新增时不传）
```

**实现逻辑**（`backend/api/v1/skills.py:197-279`）：

```python
@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_skill_file(
    request: Request,
    file: UploadFile = File(...),
    skill_uuid: str | None = Form(None),
    visibility: str = Form("private"),
    target: str | None = Form(None),  # ← 新增参数："system" 表示公共空间
    metadata: str | None = Form(None),
    current_user=Depends(require_permission("skill.upload")),
    session=Depends(get_async_session),
):
    # 如果目标是系统空间，校验管理员权限
    if target == "system":
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Admin only")
    else:
        effective_user_id = current_user.id
```

服务层适配（`backend/services/skill.py`）：

- `upload_zip_create_skill_from_path` 中，`user_id` 为 `"system"`
- 文件写入 `{SKILL_STORAGE_PATH}/__system__/{skill_name}/`
- `visibility` 强制设为 `"public"`

### 1.3.3 运维方式总结

| 场景 | 方式 | 权限 |
|------|------|------|
| 首次部署 + 批量添加 | 手动放置 Skill 文件夹到 `data/skills/__system__/`，重启服务后 `seed_public_skills()` 自动注册 | 直接操作文件系统 |
| 日常单个上传 | 用现有 API 加 `target=system` 参数，通过 curl 或脚本调用 | `is_superuser` |
| 更新已有公共 Skill | 同上 + `skill_uuid` 参数 | `is_superuser` |
| 下线公共 Skill | `POST /api/v1/skills/{uuid}/deactivate` 或 `DELETE /api/v1/skills/{uuid}`，`target=system` | `is_superuser` |

## 二、Clone 方案设计

### 2.1 Clone 语义

Clone = 完整复制一份公共 Skill 到用户自己的空间，生成独立的 Skill 记录、版本记录、文件系统副本。用户可完全自由修改，与预制版本断开关联。

### 2.2 Clone 后的数据状态

```
clone 前:
  __system__/python-data-analyzer/
    ├── SKILL.md
    ├── analyzer.py
    └── requirements.txt

clone 后 (用户空间):
  {user-uuid-1}/my-python-analyzer/  ← 新目录名（用户可自定义）
    ├── SKILL.md
    ├── analyzer.py
    └── requirements.txt
```

### 2.3 DB 记录

```sql
-- 新 Skill 记录
INSERT INTO skills (id, user_id, name, visibility, ...)
VALUES (
  '{new-uuid}',                          -- 新 UUID
  '{user-uuid-1}',                       -- 归属用户
  'my-python-analyzer',                  -- Skill 名称（用户可改）
  'private',                             -- clone 后默认私有
  NULL,                                   -- 无 enterprise_id
  NULL,                                   -- 无 team_id
  '/data/skills/{user-uuid-1}/my-python-analyzer',
  ...
);

-- 新版本记录
INSERT INTO skill_versions (skill_id, version, description, dependencies, ...)
VALUES ('{new-uuid}', '1.0.0', ...);

-- 归档文件
data/skills/_archives/{user-uuid-1}/my-python-analyzer/1.0.0.zip
```

### 2.4 Clone 时版本处理

Clone 时版本从 `1.0.0` 开始，与原公共 Skill 版本**解耦**。原因：
- 克隆后用户会改代码，版本就不同步了
- 预制 Skill 更新时，可以用 `metadata.cloned_from_version` 对比提示用户

Clone 时同时复制版本快照目录 `_versions/`，保持版本历史完整，这样用户能看到"这个 Skill 是从预制 v2.1.0 克隆来的"。

### 2.5 Clone 的文件系统操作

```python
import shutil

src = get_user_skill_dir("system", source_skill_name)   # __system__/xxx
dst = get_user_skill_dir(current_user.id, new_name)      # user-uuid/xxx

shutil.copytree(src, dst)
```

### 2.6 Clone API 设计

```
POST /api/v1/skills/{public_uuid}/clone
Content-Type: application/json

{
  "name": "my-python-analyzer",   // 可选，默认沿用原名
  "visibility": "private"          // 可选，默认 private
}

Response 201:
{
  "id": "new-uuid",
  "name": "my-python-analyzer",
  "description": "...",
  "version": "1.0.0",
  "current_version": "1.0.0",
  "files": ["SKILL.md", "analyzer.py", "requirements.txt"]
}
```

**权限**：需要 `skill.create` 权限（RBAC 关闭时始终通过）
**限制**：只能 Clone `visibility = "public"` 的 Skill

## 三、引用（Reference）方案设计

### 3.1 引用语义

引用 = 在用户空间创建一个轻量级别名记录，指向公共 Skill 的实际存储位置。用户可随时执行，但不能修改文件内容。

引用 vs Clone 的对比：

| 维度 | Clone | 引用 |
|------|-------|------|
| 存储占用 | 完整副本 | 一条 DB 记录 |
| 用户能否改代码 | 能，完全自由 | 不能，只读 |
| 预制更新 | 不感知 | 自动跟随（未锁定时） |
| 执行时文件来源 | 用户空间 | 系统空间 |
| 适合场景 | "我想定制" | "我直接用" |

### 3.2 引用记录设计

**方案 A：复用 Skill 表**

在 `skills` 表中新增字段标记引用关系：

```sql
ALTER TABLE skills ADD COLUMN source_skill_uuid VARCHAR(36) NULL;
ALTER TABLE skills ADD COLUMN source_owner VARCHAR(36) NULL;
ALTER TABLE skills ADD COLUMN pinned_version VARCHAR(50) NULL;
```

当 `source_skill_uuid IS NOT NULL` 时，表示这是一个引用 Skill。

**方案 B：独立引用表**

```sql
CREATE TABLE user_skill_references (
    id UUID PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    reference_name VARCHAR(120) NOT NULL,      -- 用户给引用起的名字
    source_skill_id UUID NOT NULL,              -- 指向 public Skill 的 ID
    source_owner VARCHAR(36) DEFAULT 'system',  -- 固定为 "system"
    source_skill_name VARCHAR(120) NOT NULL,    -- public Skill 的名称
    pinned_version VARCHAR(50) NULL,            -- NULL = 总是跟随最新
    metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, reference_name)
);
```

**推荐方案 A**（复用 Skill 表），原因：
- 引用 Skill 在执行引擎中应该像普通 Skill 一样被调用
- 现有 `execute_skill_op.py` 通过 `skill_uuid` 查记录，不需要改查询逻辑
- 只需要在读取文件时判断 `user_id == "system"` 即可知道是否引用
- 避免两张表之间的查询 JOIN 和同步问题

字段设计：

```sql
ALTER TABLE skills ADD COLUMN source_skill_uuid VARCHAR(36) NULL;
ALTER TABLE skills ADD COLUMN source_owner VARCHAR(36) NULL;
ALTER TABLE skills ADD COLUMN pinned_version VARCHAR(50) NULL;
```

引用记录的字段含义：
- `user_id` = 当前用户（引用者）
- `name` = 用户自定义的名称
- `visibility` = 固定 `private`（引用不能被分享）
- `skill_dir` = 设为系统路径（执行时直接读取）
- `source_skill_uuid` = 被引用的公共 Skill 的 UUID
- `source_owner` = 固定 `"system"`
- `pinned_version` = NULL 表示始终跟随最新版本，有值则锁定在该版本
- `current_version` = NULL（引用不使用自己的版本）

### 3.3 版本跟随 vs 版本锁定

**1. 版本跟随**（`pinned_version = NULL`）
- 预制 Skill 更新时，用户执行时自动获取最新版本
- 适合"我只想要用这个功能"的小白用户
- 执行时动态查询公共 Skill 的最新 `current_version`

**2. 版本锁定**（`pinned_version = "2.1.0"`）
- 锁定在某一个版本，不会因预制更新而变化
- 适合"我依赖这个行为不变"的场景
- 解锁后可恢复跟随

### 3.4 引用 API 设计

```
POST /api/v1/skills/{public_uuid}/reference
Content-Type: application/json

{
  "name": "my-analyzer",        // 可选，默认为公共 Skill 原名
  "pinned_version": null        // 可选，null = 跟随最新
}

Response 201:
{
  "id": "ref-uuid",
  "name": "my-analyzer",
  "source_name": "python-data-analyzer",
  "pinned_version": null,
  "current_version": "2.1.0",    // 当前公共 Skill 的最新版本
  "visibility": "private"
}
```

```
PUT /api/v1/skills/{reference_uuid}/pin     -- 锁定版本
{
  "version": "2.0.0"
}

PUT /api/v1/skills/{reference_uuid}/unpin   -- 取消锁定，恢复跟随
```

## 四、执行引擎改造

### 4.1 当前问题

`execute_skill_op.py:129` 当前实现：

```python
version_dir = get_skill_versions_dir(user_id, skill.name) / version
```

执行引擎**硬编码**从 `{user_id}/{skill_name}/_versions/{version}/` 找文件。对于引用 Skill，这个路径不存在，必须修改。

### 4.2 改造方案

在 Skill 模型中添加一个 `source_skill_uuid` 字段。执行时：

```python
# execute_skill_op.py async_execute 方法中:
version = version_input or skill.current_version or ""

# 如果是引用，使用系统目录
if skill.user_id == "system":
    version_dir = get_skill_versions_dir("system", skill.name) / version
elif skill.source_skill_uuid:
    # 用户引用：查找源 Skill 的信息
    source_skill = await skill_repo.get_by_id(skill.source_skill_uuid)
    version = pinned_version or source_skill.current_version
    version_dir = get_skill_versions_dir("system", source_skill.name) / version
else:
    # 普通用户 Skill
    version_dir = get_skill_versions_dir(user_id, skill.name) / version
```

如果公共 Skill 更新，引用用户的执行会自动使用新版本（因为 `pinned_version = None` 时动态取最新的 `current_version`）。

### 4.3 引用执行的文件来源

引用 Skill 的 `skill_dir` 字段可以设为系统路径：

```python
# 统一使用 source_skill_dir（如果是引用则指向系统目录）
source_dir = skill.source_skill_uuid
if source_dir:
    source_skill_name = (await skill_repo.get_by_id(source_dir)).name
    version_dir = get_skill_versions_dir("system", source_skill_name) / version
else:
    version_dir = get_skill_versions_dir(user_id, skill.name) / version
```

## 五、可见性逻辑改造

### 5.1 rbac.py 改造

`backend/core/security/rbac.py:53-66`：

```python
def is_skill_visible(user: User, skill: Skill) -> bool:
    if skill.visibility == "public":
        return True
    return skill.user_id == user.id
```

### 5.2 Repository 改造

`backend/repositories/skill.py:70-100` list_visible 方法：

```python
async def list_visible(
    self,
    user_id: str,
    enterprise_id: str | None = None,
    team_id: str | None = None,
    skip: int = 0,
    limit: int = 100,
    query: str | None = None,
    include_inactive: bool = False,
) -> list[Skill]:
    stmt = select(Skill)
    if not include_inactive:
        stmt = stmt.where(Skill.is_active.is_(True))
    # 新增 public 可见性
    stmt = stmt.where(
        or_(
            Skill.visibility == "public",  # 公共 Skill 对所有用户可见
            Skill.user_id == user_id,       # 自己的 Skill
        )
    )
    if query:
        stmt = stmt.where(
            or_(
                Skill.name.ilike(f"%{query}%"),
                Skill.description.ilike(f"%{query}%"),
            )
        )
    stmt = stmt.order_by(Skill.created_at.desc()).offset(skip).limit(limit)
    result = await self.session.execute(stmt)
    return list(result.scalars().all())
```

### 5.3 公共 Skill 独立接口

为了前端方便，可以增加一个专门的公共 Skill 接口（不需要用户登录也能浏览）：

```
GET /api/v1/skills/public?skip=0&limit=20&q=python
```

Response:
```json
{
  "items": [
    {
      "id": "public-uuid",
      "name": "python-data-analyzer",
      "description": "...",
      "tags": ["python", "data"],
      "current_version": "2.1.0",
      "has_reference": false,
      "cloned": false
    }
  ],
  "total": 5
}
```

`has_reference` 字段表示当前用户是否已经引用了这个公共 Skill，`cloned` 表示是否已经 Clone 过。

## 六、完整 API 汇总

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/v1/skills/public` | 浏览公共 Skill 列表 | 无需登录 / 登录 |
| GET | `/api/v1/skills/public/{uuid}` | 查看公共 Skill 详情 | 无需登录 / 登录 |
| POST | `/api/v1/skills/{public_uuid}/clone` | Clone 到自己的空间 | `skill.create` |
| POST | `/api/v1/skills/{public_uuid}/reference` | 创建引用 | `skill.create` |
| PUT | `/api/v1/skills/{ref_uuid}/pin` | 锁定引用版本 | `skill.update` (owner only) |
| PUT | `/api/v1/skills/{ref_uuid}/unpin` | 解锁引用版本 | `skill.update` (owner only) |
| DELETE | `/api/v1/skills/{ref_uuid}` | 删除引用 | `skill.delete` (owner only) |

## 七、数据模型变更

### 7.1 Skill 表新增字段

```python
# backend/models/skill.py
class Skill(...):
    # ... 现有字段 ...
    source_skill_uuid: Mapped[str | None] = mapped_column(String(36), nullable=True)
    source_owner: Mapped[str | None] = mapped_column(String(36), nullable=True)
    pinned_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
```

### 7.2 visibility 字段变更

```python
# backend/models/skill.py
# 原来: visibility = "private" / "team" / "enterprise"
# 新增: visibility = "public"
```

### 7.3 Alembic 迁移

```python
# backend/db/migrations/versions/xxx_add_public_skills.py

def upgrade():
    op.add_column('skills', sa.Column('source_skill_uuid', sa.String(36), nullable=True))
    op.add_column('skills', sa.Column('source_owner', sa.String(36), nullable=True))
    op.add_column('skills', sa.Column('pinned_version', sa.String(50), nullable=True))
    op.create_index('ix_skills_source_skill_uuid', 'skills', ['source_skill_uuid'])
    op.execute("""
        INSERT INTO skills (id, user_id, ...) VALUES
        ('system-uuid-1', 'system', ...)
    """)

def downgrade():
    op.drop_column('skills', 'pinned_version')
    op.drop_column('skills', 'source_owner')
    op.drop_column('skills', 'source_skill_uuid')
```

## 八、前端改动

### 8.1 公共 Skills 页面

新增 `/public-skills` 页面：

- 展示所有公共 Skill 卡片（名称、描述、Tags、当前版本）
- 每个卡片两个操作按钮：
  - **"添加到我的 Skills"** → 创建引用（默认）
  - **"复制一份"** 下拉选项 → 创建 Clone

### 8.2 用户 Skill 列表页

在 `/skills` 页面区分：
- 📌 引用 Skill：显示"引用自 xxx · 版本跟随"或"引用自 xxx · 已锁定 v2.1.0"
- 📦 Clone Skill：普通样式，与自主上传的 Skill 一致

### 8.3 API Client 更新

`frontend/src/lib/api.ts` 新增：
```typescript
export const getPublicSkills = (query?: string) => api.get('/skills/public', { params: { q: query } })
export const getPublicSkill = (uuid: string) => api.get(`/skills/public/${uuid}`)
export const cloneSkill = (uuid: string, data: CloneRequest) => api.post(`/skills/${uuid}/clone`, data)
export const referenceSkill = (uuid: string, data: ReferenceRequest) => api.post(`/skills/${uuid}/reference`, data)
export const pinSkillVersion = (uuid: string, version: string) => api.put(`/skills/${uuid}/pin`, { version })
export const unpinSkillVersion = (uuid: string) => api.put(`/skills/${uuid}/unpin`)
```

## 九、文件改动清单

### 后端

| 文件 | 改动 |
|------|------|
| `backend/models/skill.py` | 新增 `source_skill_uuid`, `source_owner`, `pinned_version` 字段 |
| `backend/core/security/rbac.py` | `is_skill_visible` 增加 `public` 判断 |
| `backend/repositories/skill.py` | `list_visible` 增加 public 过滤 |
| `backend/services/skill.py` | 新增 `clone_skill()`, `reference_skill()`, `pin_version()`, `unpin_version()` 方法 |
| `backend/api/v1/skills.py` | 新增 `/public`, `/public/{uuid}`, `/skills/{uuid}/clone`, `/skills/{uuid}/reference` 路由 |
| `backend/core/tools/execute_skill_op.py` | 执行时判断是否引用，从系统目录读取文件 |
| `backend/core/utils/skill_storage.py` | 新增 `__system__` 目录相关工具函数 |
| `backend/db/migrations/versions/xxx_add_public_skills.py` | 数据库迁移脚本 |

### 前端

| 文件 | 改动 |
|------|------|
| `frontend/src/app/public-skills/page.tsx` | 新增公共 Skills 页面 |
| `frontend/src/app/skills/page.tsx` | 区分标识引用/Clone 的 Skill |
| `frontend/src/lib/api.ts` | 新增公共 Skills 和引用相关 API 调用 |

## 十、向后兼容

- `visibility` 字段新增 `public` 值，不影响现有的 `private`/`team`/`enterprise`
- 新增字段均为 `nullable`，不影响现有 Skill 记录
- `__system__` 用户目录独立，不与任何现有用户冲突
- 现有上传/执行流程完全不变

## 十一、初始化公共 Skill

系统部署时通过以下方式预置公共 Skill：

1. **数据文件** — 在 `data/skills/__system__/` 目录下放置预制 Skill 的完整目录
2. **DB 初始化脚本** — 系统启动时扫描 `__system__` 目录，自动创建对应的 `skills` 和 `skill_versions` 记录
3. 或者通过 Alembic 迁移脚本直接插入

## 十二、后续可扩展方向

1. **社区贡献** — 允许用户上传 Skill 到公共库（需审核机制）
2. **分类/标签筛选** — 前端公共 Skills 页面支持按 Tag 过滤
3. **引用通知** — 公共 Skill 更新时，通知引用用户有新版本
4. **企业版复用** — 企业版可以基于 `enterprise` 可见性做类似的内部公共库
