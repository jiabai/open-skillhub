# Public Skills + Reference / Clone 设计修订稿

## 概述

目标是在"未开启 RBAC、以个人私有化部署为主"的场景下，引入一组可直接使用的公共 Skill，并同时支持两种消费方式：

- `Reference`：用户创建一个只读引用，运行时直接读取公共 Skill 的版本目录。
- `Clone`：用户复制出一份私有副本，后续完全独立演进。

这份修订稿保留原方案的产品方向，但修复了原文中的几个关键问题：

1. 将 `ENABLE_RBAC` 和 `ENABLE_SKILL_VISIBILITY` 混为一谈。
2. 直接把 `skills.user_id` 写成 `"system"`，与当前 `skills.user_id -> users.id` 外键约束冲突。
3. 在 RBAC 关闭时允许任意登录用户上传到公共空间，权限边界过宽。
4. 只修改执行入口，不处理读文件、列文件、删除、版本解析等共用路径。

## 设计目标

- 新用户注册后可以浏览并使用预置的公共 Skill。
- 用户既能"直接用"，也能"复制后改"。
- 不破坏现有私有 Skill、版本归档、下载与执行链路。
- 在不引入管理后台的前提下，保留可运维的公共 Skill 发布方式。

## 非目标

- 本期不做社区投稿、审核流、评分系统。
- 本期不允许普通用户通过 Web/API 直接维护公共 Skill。
- 本期不改变企业 RBAC 模式下 `private/team/enterprise` 的既有语义。

## 现状与问题

### 1. 可见性开关判断错误

当前代码中真正控制 Skill 可见性的开关是 `ENABLE_SKILL_VISIBILITY`，不是 `ENABLE_RBAC`。

`backend/core/security/rbac.py` 当前实现：

```python
def is_skill_visible(user: User, skill: Skill) -> bool:
    if not settings.ENABLE_SKILL_VISIBILITY:
        return skill.user_id == user.id
    visibility = (skill.visibility or settings.DEFAULT_SKILL_VISIBILITY or "private").strip().lower()
    if visibility == "enterprise":
        return bool(user.enterprise_id) and user.enterprise_id == skill.enterprise_id
    if visibility == "team":
        return (
            bool(user.enterprise_id)
            and user.enterprise_id == skill.enterprise_id
            and bool(user.team_id)
            and user.team_id == skill.team_id
        )
    return skill.user_id == user.id
```

因此，公共 Skill 的可见性设计必须优先围绕 `ENABLE_SKILL_VISIBILITY` 落地；是否只在 `ENABLE_RBAC=false` 时开放公共能力，可以作为产品层面的附加限制，但不能替代底层可见性判断。

### 2. `"system"` 不是可直接写入的 `user_id`

当前 `Skill` 模型要求：

```python
user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
```

所以原文中直接写：

```sql
INSERT INTO skills (..., user_id, ...) VALUES (..., 'system', ...)
```

在现有模型下不可行，除非同时满足下面至少一个条件：

- 预先插入一个真实的 `users` 记录作为系统账号。
- 放宽或移除 `skills.user_id` 的外键约束。

本方案选择第一种：保留外键，新增保留系统账号。

### 3. 公共库写权限不能依赖"RBAC 关闭"

原文建议：

- RBAC 开启时仅 superuser 可上传到公共空间。
- RBAC 关闭时任意已登录用户都可操作公共空间。

这会导致个人部署里任何普通用户都能篡改公共 Skill，风险过高，也和"公共库由运维/开发者维护"的目标矛盾。

修订后原则：

- 普通用户永远不能通过业务 API 写公共空间。
- 公共 Skill 的增删改只走本地文件系统 + 同步脚本，或未来单独的管理员接口。

### 4. 路径解析不能只改执行入口

当前执行入口硬编码读取：

```python
version_dir = get_skill_versions_dir(user_id, skill.name) / version
```

但同类问题不只存在于执行链路，还存在于：

- 读取 Skill 文件
- 列出 Skill 文件
- 版本 diff / 下载
- 删除 / 停用时的目录定位

如果只改 `execute_skill_op.py`，Reference Skill 在其他操作上仍会出错。应该抽象出统一的"源 Skill 目录解析"逻辑。

## 总体方案

### 1. 新增公共 Skill 概念，但不引入新的权限模型

在 `ENABLE_SKILL_VISIBILITY=true` 时新增一个可见性值：

- `public`

可见性语义：

| 场景 | visibility | 说明 |
|---|---|---|
| 私有 Skill | `private` | 仅 owner 可见 |
| 团队 Skill | `team` | 仅 RBAC 场景有效 |
| 企业 Skill | `enterprise` | 仅 RBAC 场景有效 |
| 公共 Skill | `public` | 所有用户可见，只读消费 |

可见性判断修订为：

```python
def is_skill_visible(user: User, skill: Skill) -> bool:
    if not settings.ENABLE_SKILL_VISIBILITY:
        return skill.user_id == user.id

    visibility = (skill.visibility or settings.DEFAULT_SKILL_VISIBILITY or "private").strip().lower()

    if visibility == "public":
        return True
    if visibility == "enterprise":
        return bool(user.enterprise_id) and user.enterprise_id == skill.enterprise_id
    if visibility == "team":
        return (
            bool(user.enterprise_id)
            and user.enterprise_id == skill.enterprise_id
            and bool(user.team_id)
            and user.team_id == skill.team_id
        )
    return skill.user_id == user.id
```

对应地，`SkillRepository.list_visible()` / `count_visible()` 也要补上 `public` 分支，而不是仅在 `ENABLE_RBAC` 上做条件切换。

### 2. 使用保留系统账号承载公共 Skill

新增一个保留用户，例如：

- `id = 00000000-0000-0000-0000-000000000001`
- `username = __system__`
- `email = system@local.invalid`
- `is_active = false`
- `is_superuser = true`

作用：

- 满足 `skills.user_id` 外键约束。
- 避免把 `Skill.user_id` 改造成 nullable 或特殊字符串。
- 对现有 repository / relationship 影响最小。

### 3. 存储层使用系统别名目录

数据库中的 owner 是保留系统账号，但文件系统仍使用更清晰的目录别名：

```text
data/skills/
├── __system__/
│   ├── python-data-analyzer/
│   └── markdown-to-pdf/
├── {user-id-1}/
└── {user-id-2}/
```

为避免把系统账号 UUID 暴露到目录层，增加统一 helper：

```python
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"
SYSTEM_STORAGE_OWNER = "__system__"

def resolve_storage_owner(user_id: str) -> str:
    return SYSTEM_STORAGE_OWNER if user_id == SYSTEM_USER_ID else user_id

def get_user_skill_dir(user_id: str, skill_name: str) -> Path:
    base = Path(settings.SKILL_STORAGE_PATH)
    return base / resolve_storage_owner(user_id) / skill_name
```

这样可以同时满足：

- DB 层保持真实外键。
- 文件系统层保留 `__system__` 可读性。

## 数据模型修订

### 1. `skills` 表新增引用字段

建议最小化扩展，不新建额外引用表，直接复用 `skills` 表：

```python
class Skill(...):
    ...
    source_skill_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("skills.id"), nullable=True)
    pinned_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
```

字段语义：

- `source_skill_id is null`
  - 普通 Skill 或公共 Skill
- `source_skill_id is not null`
  - Reference Skill，运行时读取源 Skill
- `pinned_version is null`
  - 跟随源 Skill 当前版本
- `pinned_version is not null`
  - 锁定在指定版本

不再使用原文中的 `source_owner`：

- 源 Skill 本身已经能提供 owner 信息。
- `source_owner` 与 `source_skill_id` 冗余，容易失真。

### 2. `source_skill_id` 的外键策略

`source_skill_id` 应显式声明为自引用外键，但不做级联删除：

```python
source_skill_id: Mapped[str | None] = mapped_column(
    String(36),
    ForeignKey("skills.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
)
```

原因：

- Reference 记录本质上依赖源 Skill，但源 Skill 下线时不应把用户记录直接物理删除。
- 当源 Skill 被停用、移除或同步脚本标记为失效时，Reference 应保留记录，以便前端展示"来源已失效"并允许用户删除。

配套规则：

- `source_skill_id is null` 且 `visibility = public`：公共 Skill
- `source_skill_id is null` 且 `visibility != public`：普通 Skill / Clone Skill
- `source_skill_id is not null`：Reference Skill

### 3. Clone 来源信息

Clone 来源不新增结构化字段，不参与运行时逻辑。

若前端需要展示"从哪里 Clone 而来"，统一写入 `skill_versions.metadata` 的首个版本记录：

```json
{
  "cloned_from_skill_id": "public-skill-uuid",
  "cloned_from_version": "2.1.0"
}
```

这样不需要改 `skills` 表，而当前仓库已经存在 `skill_versions.metadata_json`。

## 规范化术语

为避免编码阶段再出现语义漂移，本期统一使用以下术语：

- 公共 Skill：`visibility = public` 的系统预置 Skill
- Reference Skill：`source_skill_id != null` 的用户引用记录
- Clone Skill：从公共 Skill 复制出的普通私有 Skill，`source_skill_id = null`
- 普通 Skill：用户自行创建或上传的私有 / team / enterprise Skill

## 精确约束

### 1. 启用条件

本能力只在以下条件同时满足时启用：

- `ENABLE_SKILL_VISIBILITY = true`
- `ENABLE_RBAC = false`

原因：

- `public` 依赖可见性系统工作。
- 本期目标明确限定为个人私有化场景，不与企业级 `team / enterprise` 公共分发语义混用。

若 `ENABLE_RBAC = true`：

- 不暴露 `/api/v1/skills/public*`
- 不暴露 reference / clone / pin / unpin 接口
- `visibility = public` 视为保留值，不用于企业模式

### 2. Reference 的可变更范围

Reference Skill 在用户视角下是"记录可改、文件不可改"。允许与禁止的操作必须明确：

| 操作 | Reference 是否允许 | 说明 |
|---|---|---|
| 获取详情 | 允许 | 返回自身记录 + 源 Skill 衍生信息 |
| 列文件 | 允许 | 列出源版本目录下的文件 |
| 读文件 | 允许 | 只读读取源版本目录 |
| 执行 | 允许 | 解析到源版本目录执行 |
| 改名 | 允许 | 仅修改引用记录的 `name` |
| 修改 `pinned_version` | 允许 | 通过 pin / unpin 接口 |
| 修改 `description` / `tags` / `visibility` | 禁止 | 避免把引用记录伪装成独立 Skill |
| 上传单文件 | 禁止 | 返回 `409 REFERENCE_SKILL_READ_ONLY` |
| 上传 ZIP 更新 | 禁止 | 返回 `409 REFERENCE_SKILL_READ_ONLY` |
| 查看版本列表 | 允许 | 返回源 Skill 的版本列表 |
| diff 版本 | 允许 | 对源 Skill 的版本做 diff |
| deactivate / activate | 禁止 | 引用不具备独立运行态管理 |
| delete | 允许 | 仅删除引用记录本身 |

### 3. Clone 的行为边界

Clone 后生成的是普通私有 Skill，后续行为与用户自建 Skill 一致：

- 允许上传文件
- 允许上传 ZIP 更新
- 允许改名
- 允许 activate / deactivate
- 允许删除
- 不再与源 Skill 发生运行时耦合

## 数据迁移规范

### 1. Migration 内容

迁移必须包含以下部分：

1. 为 `skills` 新增列：
   - `source_skill_id VARCHAR(36) NULL`
   - `pinned_version VARCHAR(50) NULL`
2. 为 `source_skill_id` 创建索引
3. 插入保留系统账号
4. 不在 migration 中插入具体公共 Skill 记录

不建议在 Alembic 中直接写死公共 Skill 数据。公共 Skill 属于部署内容，不属于 schema。

### 2. 保留系统账号创建策略

保留系统账号的唯一真源是 migration。

启动期的 `sync_public_skills.py` 只做兜底校验：

- 若系统账号存在：继续
- 若不存在：抛出启动错误并记录日志，不在运行时偷偷创建

原因：

- 用户表属于核心数据，不应由业务同步脚本隐式写入
- migration 更适合保证跨环境一致性

## 公共 Skill 的发布与维护

## 公共 Skill 的发布与维护

### 原则

公共 Skill 的维护只允许开发者 / 运维在服务器侧完成，不通过普通用户业务接口暴露。

### 初始化

系统启动后执行同步脚本：

1. 确保保留系统账号存在。
2. 扫描 `data/skills/__system__/`。
3. 为缺失的目录创建 `skills` / `skill_versions` 记录。
4. 对已存在记录执行"以文件系统为准"的版本同步。

建议脚本名：

- `backend/scripts/sync_public_skills.py`

这里不建议使用"只创建缺失记录、已有则跳过"的 seed 逻辑。原因是公共 Skill 需要日常更新，`seed` 语义太弱，容易遗漏同步、停用、版本修正等场景。

### 日常维护

运维流程统一为：

1. 将公共 Skill 文件更新到 `data/skills/__system__/...`
2. 执行 `sync_public_skills.py`
3. 由脚本补齐 DB、版本记录、归档和 `current_version`

本期不做：

- `POST /skills/upload?target=system`
- `DELETE /skills/{uuid}?target=system`

这两类接口未来若要开放，也应该是独立管理员接口，而不是复用普通上传 / 删除 API。

### 同步脚本规则

`sync_public_skills.py` 的行为必须定义清楚：

| 场景 | 处理规则 |
|---|---|
| 目录新增，DB 不存在 | 创建公共 Skill 记录和版本记录 |
| 目录已存在，DB 已存在 | 同步描述、版本记录、`current_version` |
| DB 有记录但目录缺失 | 将 Skill 标记为 `is_active = false`，不物理删除 |
| 目录存在但缺少 `SKILL.md` | 记录 warning，跳过该目录 |
| `SKILL.md` frontmatter 缺少 `description` | 使用空字符串，不阻断同步 |
| `_versions/` 下存在多个版本 | 以 semver 最大值作为 `current_version` |
| 版本目录被删除 | 不删除历史 `skill_versions` 记录，但若该版本是 `current_version`，重新选取最大可用版本 |

脚本必须保证幂等：

- 同一目录重复同步不会创建重复 `skills`
- 同一版本重复同步不会创建重复 `skill_versions`

## API 详细规范

### 1. 响应模型扩展

现有 `SkillResponse` 不足以表达 Reference 和公共 Skill 状态，至少需要扩展以下字段：

```python
class SkillResponse(BaseModel):
    ...
    source_skill_id: str | None = None
    pinned_version: str | None = None
    resolved_version: str | None = None
    skill_kind: Literal["regular", "public", "reference", "clone"]
    is_reference_read_only: bool = False
```

说明：

- `resolved_version` 仅对公共 Skill / Reference Skill 有意义
- `skill_kind` 由后端统一计算，前端不要自行推导
- `clone` 的判定规则：
  - `source_skill_id is null`
  - `visibility != public`
  - 且首个版本 metadata 中存在 `cloned_from_skill_id`

若本期不想在 `SkillResponse` 中承载 `clone` 来源细节，至少也要返回 `skill_kind`

### 2. `GET /api/v1/skills/public`

规范：

- 仅在 `ENABLE_RBAC=false` 且 `ENABLE_SKILL_VISIBILITY=true` 时注册
- 允许匿名访问
- 仅返回 `visibility = public` 且 `is_active = true` 的记录

查询参数：

- `skip`
- `limit`
- `q`

响应中增加两个用户态字段，匿名时固定为 `false`：

- `has_reference`
- `has_clone`

### 3. `POST /api/v1/skills/{public_uuid}/reference`

请求约束：

- 源 Skill 必须存在
- 源 Skill 必须 `visibility = public`
- 同一用户下 `name` 必须唯一
- 若传 `pinned_version`，该版本必须在源 Skill 中存在

成功行为：

- 创建 `visibility = private` 的新记录
- `source_skill_id = public_uuid`
- `pinned_version = request.pinned_version`
- `skill_dir` 写为空字符串或源目录均可，但本期推荐写空字符串，避免误导
- `current_version` 置空，由运行时解析

### 4. `POST /api/v1/skills/{public_uuid}/clone`

请求约束：

- 源 Skill 必须存在
- 源 Skill 必须 `visibility = public`
- 新名称必须满足现有 skill name 校验
- 同一用户下名称不可冲突

成功行为：

- 复制源 Skill 当前解析版本目录到新 Skill
- 创建普通私有 Skill
- 写入 `1.0.0` 的首版本
- 在 `skill_versions.metadata_json` 中记录 clone 来源

### 5. `PUT /api/v1/skills/{reference_uuid}/pin`

请求：

```json
{ "version": "2.1.0" }
```

约束：

- 目标 Skill 必须是当前用户拥有的 Reference Skill
- 目标版本必须存在于源 Skill

成功行为：

- 更新 `pinned_version`
- 返回新的 `resolved_version`

### 6. `PUT /api/v1/skills/{reference_uuid}/unpin`

成功行为：

- 将 `pinned_version` 置空
- `resolved_version` 回退为源 Skill 的 `current_version`

## 错误语义

为避免实现时返回码随意，本期统一错误码：

| 场景 | HTTP | code |
|---|---|---|
| 公共能力未启用 | `404` | `PUBLIC_SKILLS_DISABLED` |
| 源 Skill 不存在或不可见 | `404` | `SKILL_NOT_FOUND` |
| 非公共 Skill 被用于 reference / clone | `400` | `SKILL_NOT_PUBLIC` |
| 目标名称冲突 | `409` | `SKILL_ALREADY_EXISTS` |
| Reference 只读操作被写入 | `409` | `REFERENCE_SKILL_READ_ONLY` |
| pin 到不存在的版本 | `404` | `VERSION_NOT_FOUND` |
| Reference 指向的源 Skill 已失效 | `409` | `SOURCE_SKILL_UNAVAILABLE` |

## 统一的源目录解析

## Reference 设计

### 语义

Reference = 用户创建一个私有的"轻量引用记录"，文件不复制，执行时解析到公共 Skill 的源版本目录。

### 数据示例

```text
公共 Skill:
  owner = SYSTEM_USER_ID
  visibility = public
  source_skill_id = null

用户 Reference:
  owner = current_user.id
  visibility = private
  source_skill_id = {public_skill.id}
  pinned_version = null | "2.1.0"
```

### 版本策略

- `pinned_version = null`
  - 跟随源 Skill 的 `current_version`
- `pinned_version = x.y.z`
  - 锁定在指定版本

Reference 不创建自己的 `_versions/` 目录，也不生成自己的归档 zip。

### API

```http
POST /api/v1/skills/{public_uuid}/reference
Content-Type: application/json

{
  "name": "my-analyzer",
  "pinned_version": null
}
```

响应示例：

```json
{
  "id": "reference-uuid",
  "name": "my-analyzer",
  "visibility": "private",
  "source_skill_id": "public-uuid",
  "pinned_version": null,
  "resolved_version": "2.1.0"
}
```

## Clone 设计

### 语义

Clone = 从公共 Skill 复制出一个新的私有 Skill，生成独立目录、独立版本、独立生命周期。

### 行为原则

- 复制当前源版本文件到用户目录。
- 新 Skill 的 `visibility` 默认 `private`。
- 新 Skill 的初始版本固定从 `1.0.0` 开始。
- 后续源 Skill 更新不会影响 clone 副本。

### API

```http
POST /api/v1/skills/{public_uuid}/clone
Content-Type: application/json

{
  "name": "my-python-analyzer",
  "visibility": "private"
}
```

响应示例：

```json
{
  "id": "new-skill-uuid",
  "name": "my-python-analyzer",
  "visibility": "private",
  "version": "1.0.0"
}
```

## 统一的源目录解析

这是本设计最关键的工程点。不要在 `execute_skill_op.py` 单点写分支，而要抽成公共解析函数，例如：

```python
async def resolve_skill_source(skill: Skill, version: str | None) -> tuple[Skill, str, Path]:
    source_skill = skill
    resolved_version = version or skill.current_version or ""

    if skill.source_skill_id:
        source_skill = await skill_repo.get_by_id(skill.source_skill_id)
        if not source_skill:
            raise ValueError("Source skill not found")
        resolved_version = skill.pinned_version or version or source_skill.current_version or ""

    if not resolved_version:
        raise ValueError("Version not found")

    version_dir = get_skill_versions_dir(source_skill.user_id, source_skill.name) / resolved_version
    return source_skill, resolved_version, version_dir
```

至少以下入口都要改为复用同一套解析逻辑：

- `backend/core/tools/execute_skill_op.py`
- `backend/core/tools/skill_resource_ops.py`
- `backend/services/skill.py` 中涉及版本目录和归档的读取逻辑

统一解析函数的行为规范：

1. 若 `skill.source_skill_id is null`
   - 直接把自身视为源 Skill
2. 若 `skill.source_skill_id is not null`
   - 加载源 Skill
   - 若源 Skill 不存在、非 public 或 `is_active = false`，返回 `SOURCE_SKILL_UNAVAILABLE`
3. 版本解析优先级
   - Reference Skill：`pinned_version > request.version > source.current_version`
   - 普通 / 公共 Skill：`request.version > skill.current_version`
4. 若最终版本为空或不存在，返回 `VERSION_NOT_FOUND`

这样才能保证：

- 公共 Skill 可执行
- Reference Skill 可执行
- Reference Skill 可读文件、列文件、看版本
- Clone 继续走现有私有路径，不受影响

## 接口设计

### 用户侧接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/v1/skills/public` | 浏览公共 Skill 列表 |
| `GET` | `/api/v1/skills/public/{uuid}` | 查看公共 Skill 详情 |
| `POST` | `/api/v1/skills/{public_uuid}/reference` | 创建引用 |
| `POST` | `/api/v1/skills/{public_uuid}/clone` | 创建副本 |
| `PUT` | `/api/v1/skills/{reference_uuid}/pin` | 锁定引用版本 |
| `PUT` | `/api/v1/skills/{reference_uuid}/unpin` | 取消锁定 |

### 运维侧入口

| 方式 | 说明 |
|---|---|
| 文件系统 | 修改 `data/skills/__system__/...` |
| 同步脚本 | 执行 `backend/scripts/sync_public_skills.py` |

本期不开放普通上传接口写公共空间。

## 服务层修改准则

### 1. `SkillService.update_skill()`

对 Reference Skill：

- 仅允许更新 `name`
- 拒绝更新 `description`、`tags`、`visibility`

### 2. `SkillService.upload_file*()` / `upload_zip*()`

对 Reference Skill：

- 直接拒绝，返回 `REFERENCE_SKILL_READ_ONLY`

### 3. `SkillService.delete_skill()`

对 Reference Skill：

- 仅删除 DB 记录
- 不删除源目录
- 不删除源归档

### 4. `SkillService.list_versions()` / `diff_versions()`

对 Reference Skill：

- 改为读取源 Skill 的版本记录

## 前端建议

## 前端建议

### 1. 公共 Skills 页面

新增公共列表页：

- 展示 `name`、`description`、`tags`、`current_version`
- 提供 `添加到我的 Skills` 按钮，默认创建 Reference
- 提供 `Clone 一份` 次级操作

### 2. 我的 Skills 页面

区分三类记录：

- 普通私有 Skill
- Reference Skill
- Clone Skill

Reference 需要展示：

- `引用自 xxx`
- `跟随最新版本` 或 `已锁定 vX.Y.Z`

Reference 的按钮状态：

- 隐藏"上传文件"
- 隐藏"上传 ZIP"
- 隐藏"停用 / 启用"
- 保留"删除"
- 保留"锁定版本 / 取消锁定"

## 测试验收

### 后端单测

至少补以下测试：

1. `is_skill_visible()` 在 `public` 场景下返回正确
2. `list_visible()` / `count_visible()` 能返回公共 Skill
3. 创建 Reference 成功，且不创建本地文件目录
4. 创建 Clone 成功，且生成独立目录和 `1.0.0` 版本
5. Reference 执行时解析到源 Skill 目录
6. Reference 文件读取走源目录
7. Reference 上传文件被拒绝
8. pin / unpin 版本生效
9. 源 Skill 被停用后，Reference 返回 `SOURCE_SKILL_UNAVAILABLE`
10. 同步脚本重复执行幂等

### API 测试

至少覆盖：

1. 匿名访问 `/skills/public`
2. 登录用户 reference 公共 Skill
3. 登录用户 clone 公共 Skill
4. 非公共 Skill 调用 reference / clone 被拒绝
5. Reference 调用写接口被拒绝

### 手工验收

1. 初始化 `data/skills/__system__/` 后重启服务，公共 Skill 可见
2. Reference 后立即可执行
3. 源 Skill 更新并同步后，未 pin 的 Reference 自动跟随
4. 已 pin 的 Reference 不受源版本变化影响
5. Clone 后继续编辑，不影响源 Skill

## 向后兼容

- 现有 `private/team/enterprise` 语义保持不变。
- `public` 仅在可见性逻辑中新增，不破坏旧数据。
- 新字段均可 `nullable`，迁移成本低。
- 公共 Skill 的 owner 通过保留系统账号承载，不需要改掉现有外键结构。

## 需要修改的文件

### 后端

| 文件 | 改动 |
|---|---|
| `backend/models/skill.py` | 新增 `source_skill_id`、`pinned_version` |
| `backend/core/security/rbac.py` | `is_skill_visible()` 增加 `public` |
| `backend/repositories/skill.py` | `list_visible()` / `count_visible()` 补充 `public` 过滤 |
| `backend/core/utils/skill_storage.py` | 增加系统 owner 目录映射 |
| `backend/services/skill.py` | 增加公共 / 引用 / clone 的创建与解析逻辑 |
| `backend/core/tools/execute_skill_op.py` | 改为调用统一源目录解析 |
| `backend/core/tools/skill_resource_ops.py` | 同上 |
| `backend/api/v1/skills.py` | 新增公共列表、reference、clone、pin/unpin 接口 |
| `backend/scripts/sync_public_skills.py` | 同步文件系统中的公共 Skill |
| `backend/db/migrations/...` | 新增字段、索引、保留系统账号初始化 |

### 前端

| 文件 | 改动 |
|---|---|
| `frontend/src/app/public-skills/page.tsx` | 公共 Skill 列表页 |
| `frontend/src/app/skills/page.tsx` | 区分普通 / Reference / Clone |
| `frontend/src/lib/api.ts` | 新增公共相关 API client |

## 实施顺序

1. 增加保留系统账号和 schema 迁移。
2. 为存储层加系统 owner 目录映射。
3. 扩展 `public` 可见性，并修正 repository 查询。
4. 落地统一源目录解析。
5. 实现公共列表、reference、clone、pin/unpin 接口。
6. 加入 `sync_public_skills.py`，完成公共 Skill 同步闭环。
7. 最后接前端页面与状态展示。

## 结论

原方案方向是对的，但要真正落地，必须把"公共 Skill"从一个目录约定，收敛为一套完整的一致性设计：

- DB 层有合法 owner
- 可见性判断基于现有真实开关
- 公共库维护入口有明确权限边界
- 运行时通过统一解析函数处理 public / reference / clone

按这份修订稿实现，才能在不破坏现有 Skill 系统的前提下，把公共 Skill 能力稳定接入现有代码结构。
