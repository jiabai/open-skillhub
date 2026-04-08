# Public Skill、Reference Skill 与 Clone Skill 详解

## 一、背景与动机

在个人私有化部署场景下，系统需要解决一个核心问题：**如何让新用户快速获得可用技能，同时保留自定义和二次开发的空间？**

在没有引入三种类型之前，用户获取可用技能只有两个极端选项，缺乏中间地带：

**极端一：从零自建。** 用户注册后面对一片空白，所有 Skill 都要自己从头写代码、配依赖、打包 ZIP 再上传。这就像买了一台空电脑，操作系统、驱动、软件全得自己装 —— 门槛高、效率低，新手可能折腾半天还跑不起来第一个 Skill。

**极端二：固定模板。** 系统预置几个 Skill，但它们是"死"的：用户只能原样使用，作者后续发布的更新拿不到（无法更新），想基于它改造也没有独立副本可以操作（难以维护）。这就像买了一个预装软件的电脑，但软件版本永远冻结在出厂那天。

本项目引入 Public、Reference、Clone 三种类型，在上述两个极端之间建立了一条**渐进式路径**：

```mermaid
graph LR
    A[公共 Skill<br/>Public] -->|引用| B[Reference Skill]
    A -->|复制| C[Clone Skill]
    D[普通 Skill<br/>Regular]

    style A fill:#1a73e8,color:#fff
    style B fill:#34a853,color:#fff
    style C fill:#fbbc04,color:#111
    style D fill:#9aa0a6,color:#fff
```

三种类型的关系可以概括为：**公共 Skill 是源头，Reference 是轻量指针，Clone 是独立副本，普通 Skill 是用户自建。**

---

## 二、公共 Skill (Public Skill)

### 2.1 含义

公共 Skill 是由系统管理员预置的、所有登录用户均可访问的只读技能包。它存储在服务端的专用目录下，由一个保留的系统账号 (`__system__`) 在数据库中承载所有权。

**关键特征**：

| 属性 | 值 |
|------|-----|
| `visibility` | `public` |
| `owner` | 系统保留账号 (`SYSTEM_USER_ID`) |
| 存储路径 | `data/skills/__system__/{skill_name}/` |
| 可写性 | 仅运维可通过文件系统 + 同步脚本修改 |

### 2.2 用途

公共 Skill 的定位类似于 npm 上的官方包、PyPI 上的热门库、或者操作系统中预装的工具。它解决的是"冷启动"问题 —— 新用户注册后无需任何配置就能立即开始使用。

典型使用场景：

- **数据分析类**: 预置 Python 数据处理脚本，包含 pandas、numpy 依赖声明
- **文档转换类**: 预置 Markdown 转 PDF 的完整工具链
- **代码生成类**: 预置脚手架模板，支持快速初始化项目结构
- **AI 能力类**: 预置与大模型交互的标准化 prompt 模板

### 2.3 功能

公共 Skill 支持以下操作：

**用户可执行的操作**：

- 浏览公共 Skill 列表 (`GET /api/v1/skills/public`)
- 查看公共 Skill 详情、文件列表、版本历史
- 读取公共 Skill 的任意文件内容
- 执行公共 Skill（运行时解析到正确的版本目录）
- 下载公共 Skill（获取加密/非加密的归档包）
- 基于公共 Skill 创建 Reference 或 Clone

**用户不可执行的操作**：

- 修改公共 Skill 的任何内容（返回 `REFERENCE_SKILL_READ_ONLY`）
- 删除或停用公共 Skill
- 上传文件到公共 Skill 目录

**运维可执行的操作**：

- 将文件放入 `data/skills/__system__/` 对应目录
- 运行同步脚本 `sync_public_skills.py` 更新数据库记录
- 同步脚本会自动创建 Skill 记录、Version 记录、归档文件

### 2.4 设计理念

公共 Skill 的设计遵循以下原则：

**1. 单一发布入口**

公共 Skill 不通过 Web API 或管理后台发布。唯一的写入路径是服务器文件系统 + 同步脚本。这样做的好处是：避免权限边界模糊、确保变更可审计、与现有的 CI/CD 流程天然兼容。

**2. 数据与文件的分离存储**

数据库中公共 Skill 的 owner 是一个真实的系统账号 UUID（满足外键约束），但文件系统上使用语义化的 `__system__` 目录名（提升可读性）。两者通过 `resolve_storage_owner()` 函数映射：

```python
# backend/core/utils/skill_storage.py
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"
SYSTEM_STORAGE_OWNER = "__system__"

def resolve_storage_owner(user_id: str) -> str:
    return SYSTEM_STORAGE_OWNER if user_id == SYSTEM_USER_ID else user_id
```

**3. 幂等同步**

同步脚本的设计保证重复执行不会产生副作用。已存在的记录以文件系统为准进行更新，缺失的记录自动补齐，被删除的目录对应的 Skill 标记为失效但不物理删除。

**4. 条件启用**

公共 Skill 功能仅在同时满足两个条件时生效：`ENABLE_SKILL_VISIBILITY=true` 且 `ENABLE_RBAC=false`。这意味着它专为个人私有化场景设计，不与企业级 RBAC 的 `team/enterprise` 可见性冲突。

---

## 三、Reference Skill

### 3.1 含义

Reference Skill 是用户创建的"轻量级引用记录"。它不在用户的目录下复制任何文件，而是在数据库中保存一条指向源公共 Skill 的指针，运行时动态解析到源 Skill 的版本目录。

**关键特征**：

| 属性 | 值 |
|------|-----|
| `visibility` | `private`（用户私有） |
| `source_skill_id` | 指向源公共 Skill 的 ID（非空） |
| `pinned_version` | 锁定的版本号（可为 null） |
| 存储路径 | 无独立目录 |
| 文件来源 | 运行时从源 Skill 读取 |

判断一个 Skill 是否为 Reference Skill 的逻辑（`backend/services/skill.py:101-103`）：

```python
@staticmethod
def is_reference_skill(skill: Skill) -> bool:
    source_skill_id = getattr(skill, "source_skill_id", None)
    return isinstance(source_skill_id, str) and bool(source_skill_id.strip())
```

简单来说：**只要 `source_skill_id` 字段不为空，就是 Reference Skill。**

### 3.2 用途

Reference Skill 的定位类似于 Node.js 中的 `npm link`、Python 中的 `pip install -e`（可编辑安装）、或 Git 中的 symbolic reference。它的核心价值是让用户在不复制文件的前提下使用公共 Skill。

适用场景：

- **试用评估**: 用户想先体验公共 Skill 的效果，再决定是否深入使用
- **始终跟随最新**: 用户信任源 Skill 的维护者，希望自动获取更新
- **节省存储空间**: 多个用户共享同一份文件副本，不产生冗余
- **团队基准统一**: 团队成员各自创建 Reference，确保使用相同版本的 Skill

### 3.3 功能

Reference Skill 的行为围绕两个核心机制展开：**版本解析策略** 和 **读写权限边界**。

#### 版本解析策略

这是 Reference Skill 最关键的特性。当任何操作（读取文件、下载、执行等）需要确定"到底用哪个版本的文件"时，系统按以下优先级解析：

```
pinned_version（用户主动锁定的版本）
       ↓ 如果为 null
requested_version（本次请求指定的 version 参数）
       ↓ 如果为 null
source_skill.current_version（源 Skill 当前最新版本）
```

对应代码实现（`backend/services/skill.py:150-153`）：

```python
if self.is_reference_skill(skill):
    version = str(
        skill.pinned_version or requested_version or source_skill.current_version or ""
    )
else:
    version = str(requested_version or source_skill.current_version or "")
```

这意味着：

- **未 pin 且不指定版本**: 自动跟随源 Skill 的最新版本。源作者发布了 `2.0.0`，你的 Reference 下次执行就会用 `2.0.0`
- **pin 到具体版本**: 比如 pin 了 `"1.5.0"`，无论源怎么更新，你的 Reference 始终使用 `1.5.0` 的文件
- **临时指定版本**: 调用时传入 `version="1.8.0"` 可以临时覆盖 pinned 版本，但不修改 pin 记录本身

#### 下载时的版本选择行为

"下载 reference 时走 pinned version，而不是源 skill 的 current version"这句话描述的是 **Reference Skill 在下载操作中的具体版本选择策略**。下面通过完整的调用链和具体场景来说明。

**调用链路**：

当用户调用下载接口时，请求经过以下路径完成版本解析：

```mermaid
sequenceDiagram
    participant C as 客户端
    participant API as POST /download
    participant SV as SkillService
    participant RV as _resolve_version_and_record

    C->>API: { skill_uuid: "ref-xxx", version: null }
    API->>SV: download_skill(user, "ref-xxx", None)
    SV->>RV: resolve_version_dir(skill, None)

    Note over RV: is_reference_skill = True
    RV->>RV: ① 检查 skill.pinned_version
    alt pinned_version = "2.0.0"
        RV-->>SV: 返回 source_skill + "2.0.0"
    else pinned_version = None
        RV->>RV: ② 检查 requested_version (None, 跳过)
        RV->>RV: ③ 使用 source_skill.current_version
        RV-->>SV: 返回 source_skill + current_version
    end

    SV->>SV: 从返回的 version_dir 打包文件
    SV-->>C: 返回归档 (version 字段为解析结果)
```

关键代码衔接点在 `backend/services/skill.py:696-699`：

```python
async def download_skill(self, user, skill_id, version=None):
    skill = await self.get_skill(user, skill_id)
    self._ensure_active(skill)
    # ← 这里调用统一的 resolve_version_dir，内部会走 pinned_version 优先逻辑
    source_skill, target_version, _record, version_dir = await self.resolve_version_dir(skill, version)
```

也就是说，**下载、读文件、执行、列文件等所有操作共享同一套版本解析逻辑**。下载并没有特殊待遇，它只是所有消费者之一。

**三种场景的具体表现**：

假设公共 Skill `python-data-analyzer` 当前已有版本：`1.0.0`、`1.5.0`、`2.0.0`、`2.1.0`，其中 `current_version = "2.1.0"`。

| 场景 | Reference 状态 | 用户请求 | 实际下载的版本 | 原因 |
|------|---------------|---------|--------------|------|
| 场景 A | `pinned_version = "2.0.0"` | 不传 version | **`2.0.0`** | pinned 优先级最高，直接使用锁定值 |
| 场景 B | `pinned_version = "2.0.0"` | `version = "1.5.0"` | **`1.5.0`** | requested_version 覆盖了 pinned（仅本次有效） |
| 场景 C | `pinned_version = null` | 不传 version | **`2.1.0`** | pinned 为空，fallback 到源的 current_version |
| 场景 D | `pinned_version = null` | `version = "1.0.0"` | **`1.0.0`** | requested_version 直接生效 |

**场景 A 的完整数据流（核心场景）**：

这是最典型的情况 —— 用户之前 pin 到了 `"2.0.0"`，之后源作者继续迭代发布了 `"2.1.0"`。此时用户发起一次无参数的下载请求：

```http
POST /api/v1/skills/download
{
  "skill_uuid": "reference-uuid"
  // 注意: 没有 version 字段
}
```

服务端处理过程：

```
步骤 1: get_skill() → 找到 Reference 记录
步骤 2: is_reference_skill() → True
步骤 3: _resolve_source_skill() → 加载 Public Skill (current_version = "2.1.0")
步骤 4: 版本解析:
         pinned_version = "2.0.0"  ✓ 非空，直接采用
步骤 5: 定位目录:
         data/skills/__system__/python-data-analyzer/_versions/2.0.0/
步骤 6: 打包该目录下所有文件为 ZIP
步骤 7: 返回响应 { version: "2.0.0", ... }
```

用户拿到的文件内容始终来自 `2.0.0` 目录，即使源已经到了 `2.1.0`。

**如果去掉 pinned 优先策略会怎样？**

如果代码改为直接使用 `source_skill.current_version`（即不优先检查 `pinned_version`），那么上述场景 A 中用户会意外收到 `2.1.0` 的文件。这会带来几个问题：

1. **破坏用户预期**: 用户明确锁定了 `2.0.0`，却拿到了不同版本的代码
2. **环境一致性丧失**: 团队成员各自 pin 了相同版本，但下载时拿到不同结果
3. **回滚困难**: 无法通过重新下载恢复到之前的已知状态

因此，pinned_version 不仅是一个展示字段，更是一个**运行时行为控制开关**。它在所有版本敏感的操作（下载、执行、读文件）中都拥有最高优先级。

**与普通 Skill 的对比**：

普通 Skill（非 Reference）的下载没有 `pinned_version` 这个中间层：

```python
# 普通 Skill 的版本解析
version = str(requested_version or source_skill.current_version or "")
```

只有两级 fallback：请求指定版本 → 自身当前版本。而 Reference Skill 有三级：**pinned 版本 → 请求指定版本 → 源的当前版本**。多出来的这一级就是 Reference Skill 与众不同的核心所在。

#### Pin / Unpin 操作

用户可以通过 API 动态调整锁定状态：

```http
PUT /api/v1/skills/{reference_uuid}/pin
Body: { "version": "2.1.0" }   →  锁定到 2.1.0

PUT /api/v1/skills/{reference_uuid}/unpin                        →  取消锁定，恢复跟随最新
```

Pin 操作会验证目标版本是否存在于源 Skill，不存在则返回 `VERSION_NOT_FOUND`。

#### 权限边界

Reference Skill 是一种"半只读"实体。允许的操作包括：

| 操作 | 允许 | 说明 |
|------|------|------|
| 查看详情 | 是 | 返回自身记录 + 源 Skill 衍生信息 |
| 列出文件 | 是 | 列出源版本目录下的文件列表 |
| 读取文件 | 是 | 从源版本目录读取文件内容 |
| 执行 | 是 | 解析到源版本目录并执行 |
| 下载 | 是 | 打包源版本目录为归档 |
| 查看版本列表 | 是 | 返回源 Skill 的全部版本记录 |
| 版本对比 (diff) | 是 | 对源 Skill 的两个版本做差异比对 |
| 重命名 | 是 | 只改引用记录的 name 字段 |
| Pin / Unpin | 是 | 调整版本锁定策略 |
| 删除 | 是 | 仅删除引用记录本身，不影响源 Skill |

禁止的操作包括：

| 操作 | 结果 |
|------|------|
| 修改 description / tags / visibility | 返回 `409 REFERENCE_SKILL_READ_ONLY` |
| 上传单个文件 | 返回 `409 REFERENCE_SKILL_READ_ONLY` |
| 上传 ZIP 更新 | 返回 `409 REFERENCE_SKILL_READ_ONLY` |
| 停用 / 启用 | 引用不具备独立生命周期 |

### 3.4 设计理念

Reference Skill 的设计体现了以下几个核心思想：

**1. 指针而非拷贝**

这是 Reference 和 Clone 最本质的区别。Reference 在数据库中只是一条记录（几十字节的元数据），不占用任何磁盘存储。当源 Skill 有 100 个文件共 50MB 时，1000 个用户创建 Reference 不会多占用 1KB 的存储空间。

**2. 用户可控的稳定性**

通过 `pinned_version` 机制，用户可以在"跟随最新"和"锁定版本"之间自由切换。这解决了开源软件中经典的依赖升级焦虑问题：

- 你可以选择始终跟随最新（适合活跃开发的早期阶段）
- 也可以锁定到某个稳定版本（适合生产环境）

**3. 透明的重定向**

对调用方而言，Reference Skill 的接口与普通 Skill 完全一致。无论是读文件、列目录、还是执行，API 的入参和出参格式都相同。区别仅在内部实现层：普通 Skill 读自己的目录，Reference Skill 通过 `_resolve_source_skill()` 解析后读源的目录。

这个透明性使得上层代码（执行引擎、前端页面、MCP 工具）不需要为 Reference 写特殊分支。

---

## 四、Clone Skill

### 4.1 含义

Clone Skill 是从公共 Skill **完整复制**出来的独立私有 Skill。复制完成后，它与源 Skill 再无任何关联，拥有自己的目录、版本序列和完整的生命周期。

**关键特征**：

| 属性 | 值 |
|------|-----|
| `visibility` | `private`（默认） |
| `source_skill_id` | `null`（切断关联） |
| `pinned_version` | `null` |
| 存储路径 | `data/skills/{user_id}/{skill_name}/`（用户自有目录） |
| 文件来源 | 从源 Skill 复制出的独立副本 |

判定逻辑（`backend/services/skill.py:105-113`）：一个 Skill 既不是 Reference（`source_skill_id` 为空），也不是公共 Skill（`visibility != public`），且其首个版本的 `metadata_json` 中包含 `cloned_from_skill_id` 字段，则判定为 Clone Skill。

### 4.2 用途

Clone Skill 的定位类似于 `git clone`、`npm pack` + 本地安装、或"另存为"。当你需要对公共 Skill 做深度定制时，Clone 是正确选择。

典型场景：

- **功能扩展**: 在公共 Skill 的基础上添加新的命令或工具
- **适配改造**: 修改依赖版本、替换底层实现以适应本地环境
- **长期维护**: 创建一个 fork 后长期独立迭代
- **安全隔离**: 将外部代码纳入内部审查流程后再使用

### 4.3 功能

Clone 的创建过程是一个原子性的复制操作（`backend/services/skill.py:602-656`）：

**创建流程**：

```mermaid
sequenceDiagram
    participant C as 客户端
    participant S as SkillService
    participant DB as Database
    participant FS as File System

    C->>S: POST clone (public_uuid, name)
    S->>DB: 查询源 Public Skill
    S->>S: 解析源当前版本目录
    
    Note over S: 核心步骤开始
    
    S->>DB: 创建新 Skill 记录 (visibility=private)
    S->>FS: 创建版本目录 _versions/1.0.0/
    S->>FS: 复制源版本的全部文件到新目录
    S->>FS: 清空当前工作目录
    S->>FS: 复制文件到当前工作目录
    S->>DB: 创建 Version 1.0.0 记录
    S->>DB: 记录 cloned_from 元数据
    
    Note over S: 核心步骤结束
    
    S-->>C: 201 Created (新 Skill 信息)
```

**创建后的行为**：

Clone 一旦创建完成，就变成了一个完全普通的私有 Skill。它支持所有普通 Skill 的操作：

- 上传单文件 / 上传 ZIP 更新
- 创建新版本
- 版本回滚
- 停用 / 启用
- 删除
- 修改名称、描述、标签、可见性

**与源 Skill 的关系**：

Clone 的来源信息仅保存在首条 Version 记录的 `metadata_json` 中，作为纯信息字段供展示用途：

```json
{
  "cloned_from_skill_id": "原始公共Skill的UUID",
  "cloned_from_version": "2.1.0"
}

```

这段数据**不参与任何运行时逻辑**。源 Skill 后续的更新不会通知到 Clone，Clone 的变更也不会影响源 Skill。两者彻底解耦。

### 4.4 设计理念

Clone Skill 的设计围绕"独立性"展开：

**1. 完全隔离**

Clone 产生的不仅是文件副本，还有独立的版本线。源 Skill 可能已经迭代到 `5.0.0`，而你的 Clone 可能还在 `1.0.0` 并按照自己的节奏演进。两者的版本号、文件内容、依赖声明互不影响。

**2. 干净的起始点**

Clone 的初始版本固定为 `1.0.0`，而不是继承源 Skill 的版本号。这是一个刻意的选择：既然是独立分支，就应该有自己的版本语义。继承版本号会造成"我明明只改了一行代码，为什么版本号是 `2.1.0`"的困惑。

**3. 来源可追溯但不绑定**

虽然 `metadata_json` 中记录了克隆来源，但这只是元数据层面的标记。系统不会因为这条记录就限制 Clone 的行为。用户可以随意修改 Clone 的所有内容，不受源 Skill 任何约束。

---

## 五、三者对比

### 5.1 核心差异总览

```mermaid
graph TB
    subgraph Public["公共 Skill"]
        P1[owner: __system__]
        P2[visibility: public]
        P3[存储: data/skills/__system__/]
        P4[可写性: 仅运维可改]
    end

    subgraph Reference["Reference Skill"]
        R1[owner: 当前用户]
        R2[source_skill_id: 指向Public]
        R3[pinned_version: 可选锁定]
        R4[存储: 无独立目录]
        R5[可写性: 半只读]
    end

    subgraph Clone["Clone Skill"]
        C1[owner: 当前用户]
        C2[source_skill_id: null]
        C3[初始版本: 1.0.0]
        C4[存储: 用户自有目录]
        C5[可写性: 完全可写]
    end

    Public -->|"create_reference"| Reference
    Public -->|"clone"| Clone
```

### 5.2 详细对比表

| 维度 | 公共 Skill | Reference Skill | Clone Skill | 普通 Skill |
|------|-----------|----------------|-------------|-----------|
| **创建方式** | 运维同步脚本 | `POST /{id}/reference` | `POST /{id}/clone` | 上传 ZIP / 创建 |
| **文件存储位置** | `__system__/` 目录 | 无（指向源） | 用户自有目录 | 用户自有目录 |
| **是否复制文件** | 原始文件 | 否，零拷贝 | 是，完整复制 | 用户上传 |
| **存储开销** | 一份 | 接近零 | 一份完整副本 | 一份 |
| **可见性** | public（全员可见） | private（仅自己可见） | private（默认） | private/team/enterprise |
| **能否编辑** | 不能（普通用户） | 不能（只能改名/pin） | 完全可以 | 完全可以 |
| **版本跟随** | 自身迭代 | 可选跟随或锁定 | 独立迭代 | 独立迭代 |
| **删除影响** | 影响所有 Reference | 仅删引用记录 | 删自身及文件 | 删自身及文件 |
| **适用阶段** | 试用 / 生产基线 | 快速体验 / 团队统一定制 | 深度改造 / 长期维护 | 完全自建 |
| **类比** | npm 官方包 | npm link | git fork + clone | 自己写的包 |

### 5.3 如何选择

面对一个公共 Skill，用户应该选择哪种消费方式？

```mermaid
flowchart TD
    A["发现一个有用的公共 Skill"] --> B{"使用目的是什么？"}
    
    B -->|"想试试效果<br/>不确定是否长期用"| R["选 Reference<br/>零成本试用"]
    B -->|"确定要基于它做开发"| C{"需要多大改动？"}
    
    C -->|"小改动<br/>加几个文件或微调"| R2["先 Reference<br/>确认需求再决定"]
    C -->|"大改动<br/>重构或重写部分逻辑"| CL["直接 Clone<br/>获得完整控制权"]
    
    B -->|"团队统一使用<br/>不想各自维护"| R3["全员 Reference<br/>可选 pin 统一版本"]
    
    R --> U1["后续可随时<br/>删除 Reference"]
    R2 --> U2["满意就 Clone<br/>不满意就换别的"]
    CL --> U3["独立演进<br/>不受源影响"]
    R3 --> U4["运维更新源<br/>全员自动跟进"]
```

**决策建议**：

- **犹豫不决时，先用 Reference**。Reference 的创建和删除都是轻量操作，没有任何资源负担。试用满意后再考虑是否 Clone。
- **需要改动代码时，必须 Clone**。Reference 不允许任何文件写入操作，如果需要定制功能，Clone 是唯一选择。
- **团队协作场景下，推荐 Reference + pin**。团队成员各自创建 Reference 到同一个公共 Skill 并 pin 到相同版本，既能统一基线，又能在需要时灵活切换。

---

## 六、统一的源目录解析机制

### 6.1 为什么需要统一解析

在引入 Reference Skill 之前，代码中获取 Skill 版本目录的逻辑非常简单：

```python
# 旧逻辑（仅适用于普通 Skill）
version_dir = get_skill_versions_dir(user_id, skill.name) / version
```

但引入 Reference 后，这个逻辑不再成立：Reference 没有自己的版本目录，它的文件来自源 Skill。如果每个操作入口（执行、读文件、列文件、下载、diff）各自写一套 if-else 分支，代码将变得混乱且容易遗漏。

因此设计了一个统一的解析函数 `_resolve_version_and_record()`（`backend/services/skill.py:142-164`），所有需要定位版本目录的操作都必须经过它。

### 6.2 解析流程

```mermaid
flowchart TD
    A[传入 Skill 对象] --> B{"is_reference_skill?"}
    
    B -->|"否"| C["source_skill = skill 自身"]
    B -->|"是"| D["_resolve_source_skill()<br/>加载源 Public Skill"]
    
    C --> E{"是 Reference?"}
    D --> E
    
    E -->|"是"| F["version = pinned_version<br/>or requested_version<br/>or source.current_version"]
    E -->|"否"| G["version = requested_version<br/>or current_version"]
    
    F --> H["校验 version 合法性"]
    G --> H
    
    H --> I["查询 Version 记录"]
    I --> J["计算版本目录路径<br/>get_skill_versions_dir(source.user_id, source.name) / version"]
    
    J --> K["返回 (source_skill, version, record)"]
```

### 6.3 受影响的操作入口

以下所有操作都已接入统一解析逻辑：

| 操作 | 方法 | 文件位置 |
|------|------|----------|
| 下载 Skill | `download_skill()` | `skill.py:696` |
| 列出文件 | `list_skill_files()` | `skill.py:268` |
| 读取文件 | `read_skill_file()` | `skill.py:280` |
| 获取安装指令 | `get_install_instructions()` | `skill.py:739` |
| 版本对比 | `diff_versions()` | `skill.py:784` |
| 执行 Skill | `execute_skill_op.py` | 通过 resolve 接入 |
| MCP 资源操作 | `skill_resource_ops.py` | 通过 resolve 接入 |

这种集中解析的方式保证了：无论从哪个入口访问 Reference Skill，都能正确定位到源 Skill 的对应版本目录，不会出现"有的操作走了源目录、有的操作找不到文件"的不一致问题。

---

## 七、数据模型

### 7.1 skills 表结构（相关字段）

```sql
CREATE TABLE skills (
    id              VARCHAR(36) PRIMARY KEY,
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    tags            JSONB,
    visibility      VARCHAR(20) NOT NULL DEFAULT 'private',
    
    -- 新增字段（公共 Skill / Reference 相关）
    source_skill_id VARCHAR(36) NULL REFERENCES skills(id) ON DELETE SET NULL,
    pinned_version  VARCHAR(50) NULL,
    
    skill_dir       VARCHAR(500) NOT NULL DEFAULT '',
    current_version VARCHAR(50) NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skills_source_skill_id ON skills(source_skill_id);
```

### 7.2 三种类型的数据库形态

```
┌─────────────────────────────────────────────────────────────┐
│  公共 Skill                                                  │
│  id = 'aaa...'                                              │
│  user_id = SYSTEM_USER_ID ('000...001')                     │
│  name = 'python-data-analyzer'                              │
│  visibility = 'public'                                      │
│  source_skill_id = NULL                                     │
│  pinned_version = NULL                                      │
│  current_version = '2.1.0'                                  │
└─────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │ create_reference               │ clone
           ▼                                ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Reference Skill          │  │  Clone Skill              │
│  id = 'bbb...'            │  │  id = 'ccc...'            │
│  user_id = 'user-123'     │  │  user_id = 'user-123'     │
│  name = 'my-analyzer'     │  │  name = 'my-analyzer-fork'│
│  visibility = 'private'   │  │  visibility = 'private'   │
│  source_skill_id = 'aaa..'│  │  source_skill_id = NULL   │
│  pinned_version = '2.0.0' │  │  pinned_version = NULL     │
│  current_version = NULL   │  │  current_version = '1.0.0' │
│                           │  │  (独立版本线)             │
│  注意: skill_dir = ''     │  │  skill_dir 正常填充        │
│  无文件目录                │  │  有完整文件目录            │
└──────────────────────────┘  └──────────────────────────┘
```

---

## 八、API 接口一览

### 8.1 消费端接口（用户调用）

| 方法 | 路径 | 作用 |
|------|------|------|
| `GET` | `/api/v1/skills/public` | 浏览公共 Skill 列表 |
| `GET` | `/api/v1/skills/public/{uuid}` | 查看公共 Skill 详情 |
| `POST` | `/api/v1/skills/{public_uuid}/reference` | 基于 Public 创建 Reference |
| `POST` | `/api/v1/skills/{public_uuid}/clone` | 基于 Public 创建 Clone |
| `PUT` | `/api/v1/skills/{ref_uuid}/pin` | 锁定 Reference 版本 |
| `PUT` | `/api/v1/skills/{ref_uuid}/unpin` | 取消锁定，恢复跟随最新 |

### 8.2 各接口请求/响应示例

**创建 Reference**:

```http
POST /api/v1/skills/{public_uuid}/reference
Content-Type: application/json

{
  "name": "my-data-analyzer",
  "pinned_version": null
}

Response 201:
{
  "id": "reference-uuid",
  "name": "my-data-analyzer",
  "visibility": "private",
  "source_skill_id": "public-uuid",
  "pinned_version": null,
  "resolved_version": "2.1.0",
  "skill_kind": "reference",
  "is_reference_read_only": true
}
```

**创建 Clone**:

```http
POST /api/v1/skills/{public_uuid}/clone
Content-Type: application/json

{
  "name": "my-custom-analyzer",
  "visibility": "private"
}

Response 201:
{
  "id": "clone-uuid",
  "name": "my-custom-analyzer",
  "current_version": "1.0.0",
  "skill_kind": "clone"
}
```

**锁定版本**:

```http
PUT /api/v1/skills/{ref_uuid}/pin
Content-Type: application/json

{ "version": "2.0.0" }

Response 200:
{
  "id": "reference-uuid",
  "pinned_version": "2.0.0",
  "resolved_version": "2.0.0"
}
```

### 8.3 错误码速查

| 场景 | HTTP 状态码 | 错误码 |
|------|------------|--------|
| 公共能力未启用 | 404 | `PUBLIC_SKILLS_DISABLED` |
| 源 Skill 不存在 | 404 | `SKILL_NOT_FOUND` |
| 目标 Skill 不是公共的 | 400 | `SKILL_NOT_PUBLIC` |
| 名称已被占用 | 409 | `SKILL_ALREADY_EXISTS` |
| Reference 上尝试写操作 | 409 | `REFERENCE_SKILL_READ_ONLY` |
| Pin 到不存在的版本 | 404 | `VERSION_NOT_FOUND` |
| 源 Skill 已失效/停用 | 409 | `SOURCE_SKILL_UNAVAILABLE` |

---

## 九、设计约束与边界

### 9.1 启用条件

公共 Skill 及其衍生能力（Reference / Clone）**仅在以下条件同时满足时可用**：

```
ENABLE_SKILL_VISIBILITY = true   （可见性系统开启）
ENABLE_RBAC = false             （RBAC 关闭，即个人部署模式）
```

任一条件不满足时：
- `/api/v1/skills/public*` 路由不注册
- reference / clone / pin / unpin 接口不暴露
- `visibility = public` 视为保留值，不产生实际效果

### 9.2 不做的事项（本期范围边界）

以下是明确**不在本期实现**的功能，避免误解：

- 不做社区投稿、审核流、评分系统
- 不允许普通用户通过 Web/API 直接修改公共 Skill
- 不改变企业 RBAC 模式下 `private/team/enterprise` 的既有语义
- 不提供公共 Skill 的评论、反馈、star 收藏机制
- 不做跨实例的 Skill 共享（每个部署实例的公共 Skill 独立维护）

---

## 十、总结

三种 Skill 类型构成了一个分层的技能生态：

**公共 Skill 是基础设施层**。它由运维维护、全员共享、代表经过验证的稳定能力。它是整个体系的源头和基线。

**Reference Skill 是便捷接入层**。它以接近零的成本让用户立即使用公共 Skill，同时通过 pinned_version 提供可选的稳定性保障。它是"先用起来"的最佳入口。

**Clone Skill 是深度定制层**。它在公共 Skill 的基础上提供一个干净的起点，用户可以任意改造而不影响源或其他用户。它是"我要自己做"的正确路径。

三者的递进关系反映了真实世界中的软件消费模式：**浏览 → 试用 → 定制**。每一层都比上一层承担更多责任（存储、维护、版本管理），同时也获得更多自由度（可写、可改、可控）。这种分层设计让系统能够同时满足新手用户和高级用户的需求，而不需要在易用性和灵活性之间做取舍。
