---
status: draft
ai_read: true
last_updated: 2026-03-21
---

# SKILL 属性设计：dependencies、execution_mode、requires_gui、client_capabilities

## 概述

本文档详细描述了 SKILL 模块的执行属性设计，包括 `dependencies`、`execution_mode`、`requires_gui`、`client_capabilities` 四个核心属性的定义、使用场景、实现方案和前端展示规范。

**重要设计原则**：
- `dependencies` 存储在 `skill_versions` 表中（因为不同版本有独立依赖）
- `execution_mode`、`requires_gui`、`client_capabilities` 存储在 `skills` 表中（通过 API 设置）
- 用户通过前端界面或 API 来设置这些属性

SKILL.md Frontmatter 仅包含：
- `name`
- `description`
- `version`

---

## 实施状态

| 属性 | 存储位置 | 后端模型 | Schema | 数据库迁移 | 前端类型 | 状态 |
|------|----------|----------|--------|------------|----------|------|
| `dependencies` | `skill_versions` 表 | ✅ 已实现 | ✅ 已实现 | ✅ 已实现 | ❌ 待实现 | 部分完成 |
| `execution_mode` | `skills` 表 | ❌ 待实现 | ❌ 待实现 | ❌ 待实现 | ❌ 待实施 | 未开始 |
| `requires_gui` | `skills` 表 | ❌ 待实现 | ❌ 待实现 | ❌ 待实现 | ❌ 待实施 | 未开始 |
| `client_capabilities` | `skills` 表 | ❌ 待实现 | ❌ 待实现 | ❌ 待实现 | ❌ 待实施 | 未开始 |

### 已完成项

- **`dependencies` 后端实现**：
  - 模型：`backend/models/skill_version.py` 中的 `dependencies` 字段
  - Schema：通过 `SkillVersion` 相关 Schema 管理
  - 迁移：`e2f3a4b5c6d7_add_skill_versions.py`

### 待实施项

按照文档中的实施计划执行：

**Phase 1: 后端基础（高优先级）**
- [ ] 创建数据库迁移：添加 `execution_mode`、`requires_gui`、`client_capabilities` 到 `skills` 表
- [ ] 扩展 Skill 模型：添加三个新字段
- [ ] 扩展 Schema：更新 `SkillCreate`、`SkillUpdate`、`SkillResponse`
- [ ] 修改 `execute_skill`：验证 `execution_mode`

**Phase 2: 前端展示（中优先级）**
- [ ] 更新 API 类型：添加新字段的 TypeScript 定义
- [ ] 修改列表页：显示执行属性 Badge
- [ ] 修改详情页：展示执行属性详情
- [ ] 修改创建页：添加执行属性表单

**Phase 3: 完善和测试（低优先级）**
- [ ] 单元测试：验证新字段的验证逻辑
- [ ] 集成测试：验证完整流程
- [ ] 文档更新：更新 user guide

---

### 背景与问题

当前项目支持两种运行模式：
1. **Server 端运行**：通过 MCP 接口调用，Skill 在服务器端执行，返回文本结果
2. **客户端下载运行**：通过 `/api/v1/skills/download` 接口下载 ZIP 包，在客户端本地执行

但存在以下问题：
- Skill 本身没有声明适合哪种运行模式
- 客户端无法自动判断应该用哪种方式运行
- 无法根据 Skill 需求限制客户端类型
- 前端无法给用户清晰的运行方式提示

### 目标

- 让 Skill 开发者通过数据库字段明确声明运行模式和需求
- 让客户端（MCP Client/Agent）能自动选择合适的运行方式
- 让前端能给用户清晰的展示和提示
- 为未来的权限控制、能力匹配提供基础

---

## 核心属性定义

### 1. dependencies（依赖包列表）

定义 Skill 运行时需要的依赖包列表。

**存储位置**：`skill_versions` 表（不同版本有独立依赖）

| 值 | 说明 | 格式示例 |
|----|------|----------|
| `[]` | 无依赖（默认值） | `[]` |
| `["package1", "package2>=1.0.0"]` | 依赖包列表 | `["playwright>=1.40.0", "python-dotenv"]` |

#### 验证规则

- `dependencies` 必须是字符串数组
- 每个字符串应该是有效的包名或包名加版本约束
- 默认值为空数组 `[]`

---

### 2. execution_mode（执行模式）

定义 Skill 适合的运行位置和方式。

| 值 | 说明 | 适用场景 | 示例 Skill |
|----|------|----------|------------|
| `server` | 必须在 Server 端运行 | 纯文本处理、需要访问服务器资源 | 数据分析、文本处理、数据库查询 |
| `client` | 必须在客户端本地运行 | 需要 GUI、需要访问本地资源 | 浏览器自动化、屏幕录制、本地文件操作 |
| `both` | 两种方式都可以（默认值） | 通用功能，不依赖特定环境 | 简单脚本、通用工具 |

#### 验证规则

- `execution_mode` 必须是 `server`、`client`、`both` 三者之一
- 默认值为 `both`

---

### 3. requires_gui（是否需要 GUI）

定义 Skill 执行时是否需要图形用户界面。

| 值 | 说明 | 影响 |
|----|------|------|
| `true` | 需要 GUI 环境 | - Server 端运行时需要 headless 模式<br>- 客户端运行时需要桌面环境 |
| `false` | 不需要 GUI（默认值） | - 可以在任何环境运行 |

#### 验证规则

- `requires_gui` 必须是布尔值
- 默认值为 `false`

---

### 4. client_capabilities（客户端能力要求）

定义 Skill 执行时客户端需要具备的能力列表。

| 能力标识符 | 说明 | 示例 Skill |
|-----------|------|------------|
| `browser` | 浏览器能力（Chrome/Edge/Firefox） | browser-agent、网页测试 |
| `screen_capture` | 屏幕截图/录制能力 | 录屏工具、教学演示 |
| `file_system` | 文件系统读写能力 | 文件管理、数据导出 |
| `network` | 网络访问能力 | 网络爬虫、API 测试 |
| `gpu` | GPU 加速能力 | 图像处理、机器学习推理 |
| `audio` | 音频输入输出能力 | 语音识别、音频处理 |
| `camera` | 摄像头能力 | 拍照、视频录制 |

#### 验证规则

- `client_capabilities` 必须是字符串数组
- 每个字符串必须符合能力标识符规范（小写字母、下划线）
- 默认值为空数组 `[]`

---

## SKILL.md Frontmatter 规范（保持不变）

**重要**：SKILL.md Frontmatter 仅包含 `name`、`description`、`version` 三个字段。
- `dependencies` 存储在 `skill_versions` 表中（版本级别依赖，通过 API 设置）
- 执行属性（`execution_mode`、`requires_gui`、`client_capabilities`）存储在 `skills` 表中，通过 API 设置

```yaml
---
name: browser-agent
description: 浏览器自动化技能
version: 1.0.0
---

# SKILL 内容...
```

### 完整示例

#### 示例 1：Browser Agent（需要在客户端运行）

```yaml
---
name: browser-agent
description: 浏览器自动化技能，支持录制和回放操作
version: 1.0.0
---

# Browser Agent

这是一个浏览器自动化技能，需要在客户端本地运行以访问真实的浏览器环境。

## 使用方式

1. 通过 `/api/v1/skills/download` 下载此 Skill
2. 在本地解压并安装依赖
3. 运行 `python browse.py`
```

**注意**：
- 这个 Skill 的 `dependencies: ["playwright>=1.40.0", "python-dotenv"]` 是存储在 `skill_versions` 表中（版本级别依赖）
- 这个 Skill 的 `execution_mode: client`、`requires_gui: true`、`client_capabilities: ["browser", "screen_capture"]` 是存储在 `skills` 表中（Skill 级别属性）
- 以上属性都不是写在 SKILL.md 里的

---

## 后端实现方案

### 1. 数据模型扩展

#### models/skill.py

```python
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Skill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skills"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uix_user_skill_name"),
        CheckConstraint(
            "execution_mode IN ('server', 'client', 'both')",
            name="ck_execution_mode_valid"
        ),
    )

    # 原有字段
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500), default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    visibility: Mapped[str] = mapped_column(String(20), default="private")
    enterprise_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    skill_dir: Mapped[str] = mapped_column(String(500))
    current_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    cache_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 新增字段 - 执行属性（仅数据库，不通过 SKILL.md 解析）
    # 注意：dependencies 在 skill_versions 表中，因为不同版本有独立依赖
    execution_mode: Mapped[str] = mapped_column(String(20), default="both")
    requires_gui: Mapped[bool] = mapped_column(Boolean, default=False)
    client_capabilities: Mapped[list[str]] = mapped_column(JSON, default=list)

    user = relationship("User", back_populates="skills")
```

**注意**：`dependencies` 字段已存在于 `skill_versions` 表中（见 `models/skill_version.py`），此处不再重复定义。

---

### 2. Schema 扩展

#### schemas/skill.py

```python
from datetime import datetime

from pydantic import AliasChoices, BaseModel, Field, field_validator


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=50)
    visible: str = Field(
        default="private",
        max_length=20,
        validation_alias=AliasChoices("visible", "visibility"),
    )
    # 新增字段 - 执行属性（通过 API 设置）
    # 注意：dependencies 在 skill_versions 表中，通过 SkillVersionCreate 设置
    execution_mode: str = Field(default="both", max_length=20)
    requires_gui: bool = Field(default=False)
    client_capabilities: list[str] = Field(default_factory=list)

    @field_validator("execution_mode")
    @classmethod
    def validate_execution_mode(cls, v: str) -> str:
        valid_modes = {"server", "client", "both"}
        if v not in valid_modes:
            raise ValueError(f"execution_mode must be one of: {', '.join(valid_modes)}")
        return v

    @field_validator("client_capabilities")
    @classmethod
    def validate_client_capabilities(cls, v: list[str]) -> list[str]:
        valid_capabilities = {
            "browser", "screen_capture", "file_system", "network",
            "gpu", "audio", "camera"
        }
        for cap in v:
            if cap not in valid_capabilities:
                raise ValueError(f"Invalid capability: {cap}. Valid capabilities: {', '.join(valid_capabilities)}")
        return v


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None, max_length=50)
    visible: str | None = Field(
        default=None,
        max_length=20,
        validation_alias=AliasChoices("visible", "visibility"),
    )
    # 新增字段 - 执行属性（可通过 API 更新）
    # 注意：dependencies 在 skill_versions 表中，通过 SkillVersionUpdate 更新
    execution_mode: str | None = Field(default=None, max_length=20)
    requires_gui: bool | None = Field(default=None)
    client_capabilities: list[str] | None = Field(default=None)

    @field_validator("execution_mode")
    @classmethod
    def validate_execution_mode(cls, v: str | None) -> str | None:
        if v is None:
            return v
        valid_modes = {"server", "client", "both"}
        if v not in valid_modes:
            raise ValueError(f"execution_mode must be one of: {', '.join(valid_modes)}")
        return v

    @field_validator("client_capabilities")
    @classmethod
    def validate_client_capabilities(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        valid_capabilities = {
            "browser", "screen_capture", "file_system", "network",
            "gpu", "audio", "camera"
        }
        for cap in v:
            if cap not in valid_capabilities:
                raise ValueError(f"Invalid capability: {cap}. Valid capabilities: {', '.join(valid_capabilities)}")
        return v


class SkillResponse(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str]
    visible: str = Field(alias="visibility", serialization_alias="visible")
    enterprise_id: str | None
    team_id: str | None
    skill_dir: str
    current_version: str | None
    is_active: bool
    cache_revoked_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # 新增字段 - 执行属性
    # 注意：dependencies 在 SkillVersionResponse 中返回
    execution_mode: str
    requires_gui: bool
    client_capabilities: list[str]

    model_config = {"from_attributes": True, "populate_by_name": True}


# ... 其他现有 Schema 保持不变
```

**注意**：`dependencies` 字段应在 `SkillVersionCreate`、`SkillVersionUpdate`、`SkillVersionResponse` 中定义，因为依赖是版本级别的。

---

### 3. Skill 服务层修改

**重要**：SKILL.md Frontmatter 解析逻辑**不再处理 dependencies 和执行属性**。

#### services/skill.py - SKILL.md Frontmatter 解析（保持不变）

```python
def _parse_frontmatter(self, content: str) -> dict:
    """
    解析 SKILL.md 的 YAML frontmatter
    注意：只解析 name、description、version
          不解析 dependencies、execution_mode、requires_gui、client_capabilities
    """
    frontmatter = {}
    if content.startswith("---\n"):
        end_idx = content.find("\n---\n", 4)
        if end_idx != -1:
            frontmatter_str = content[4:end_idx]
            try:
                frontmatter = yaml.safe_load(frontmatter_str) or {}
            except yaml.YAMLError:
                pass

    # 只解析原有字段（name、description、version），不处理其他字段
    return frontmatter
```

#### services/skill.py - 上传时更新 Skill 属性（不涉及 dependencies 和执行属性）

```python
async def upload_skill_file(...):
    # ... 现有代码 ...

    # 从 frontmatter 提取原有字段（不包含 dependencies 和执行属性）
    frontmatter = self._parse_frontmatter(skill_md_content)

    # 更新 Skill 模型的原有字段
    if "name" in frontmatter:
        skill.name = frontmatter["name"]
    if "description" in frontmatter:
        skill.description = frontmatter["description"]
    if "version" in frontmatter:
        skill.current_version = frontmatter["version"]
    # ... 其他原有字段 ...

    # 注意：dependencies 和执行属性通过 SkillCreate/SkillUpdate API 设置，不由 SKILL.md 解析

    # ... 后续代码 ...
```

---

### 4. MCP 工具层修改

#### core/tools/execute_skill_op.py - 验证执行模式

```python
async def async_execute(self):
    # ... 现有代码 ...

    # 验证执行模式
    if skill.execution_mode == "client":
        return tool_error_payload(
            "SKILL_REQUIRES_CLIENT_MODE",
            f"This skill requires client-side execution. Please download it using /api/v1/skills/download"
        )

    # ... 后续代码 ...
```

---

### 5. 数据库迁移

需要创建 Alembic 迁移脚本添加新字段：

```python
"""add_skill_execution_properties

Revision ID: j1k2l3m4n5o6
Revises: i7j8k9l0m1n2
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'j1k2l3m4n5o6'
down_revision = 'i7j8k9l0m1n2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    # 注意：dependencies 已存在于 skill_versions 表中，此处不再添加
    op.add_column('skills', sa.Column('execution_mode', sa.String(length=20), nullable=False, server_default=sa.text("'both'")))
    op.add_column('skills', sa.Column('requires_gui', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('skills', sa.Column('client_capabilities', sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
    op.create_check_constraint(
        'ck_execution_mode_valid',
        'skills',
        "execution_mode IN ('server', 'client', 'both')"
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint('ck_execution_mode_valid', 'skills', type_='check')
    op.drop_column('skills', 'client_capabilities')
    op.drop_column('skills', 'requires_gui')
    op.drop_column('skills', 'execution_mode')
    # ### end Alembic commands ###
```

---

## 前端实现方案

### 1. API 类型定义

#### frontend/src/lib/api.ts

> **注意**：以下类型定义是对现有 `api.ts` 中类型的**扩展**，而非替换。实施时需要：
> 1. 在现有 `Skill` 类型中添加新字段
> 2. 在现有 `api.createSkill` 和 `api.updateSkill` 方法中添加新参数支持
> 3. 现有字段 `description` 在当前代码中为 `string | null`，建议保持一致
> 4. `dependencies` 在 `SkillVersion` 类型中定义，因为依赖是版本级别的

```typescript
// 扩展现有 Skill 类型（添加新字段）
export interface Skill {
  id: string;
  name: string;
  description: string | null;  // 保持与现有代码一致
  tags: string[];
  visible: string;
  enterprise_id: string | null;
  team_id: string | null;
  skill_dir: string;
  current_version: string | null;
  is_active: boolean;
  cache_revoked_at: string | null;
  created_at: string;
  updated_at: string;
  // 新增字段 - 执行属性
  // 注意：dependencies 在 SkillVersion 类型中，因为依赖是版本级别的
  execution_mode: "server" | "client" | "both";
  requires_gui: boolean;
  client_capabilities: string[];
}

export interface SkillCreate {
  name: string;
  description?: string;
  tags?: string[];
  visible?: string;
  // 新增字段 - 执行属性（通过 API 设置）
  // 注意：dependencies 在 SkillVersionCreate 中设置
  execution_mode?: "server" | "client" | "both";
  requires_gui?: boolean;
  client_capabilities?: string[];
}

export interface SkillUpdate {
  name?: string;
  description?: string | null;
  tags?: string[];
  visible?: string;
  // 新增字段 - 执行属性（可通过 API 更新）
  // 注意：dependencies 在 SkillVersionUpdate 中更新
  execution_mode?: "server" | "client" | "both";
  requires_gui?: boolean;
  client_capabilities?: string[];
}

// 能力标识符到显示名称的映射
export const CAPABILITY_LABELS: Record<string, string> = {
  browser: "浏览器",
  screen_capture: "屏幕截图",
  file_system: "文件系统",
  network: "网络访问",
  gpu: "GPU 加速",
  audio: "音频",
  camera: "摄像头",
};

// 执行模式到显示名称的映射
export const EXECUTION_MODE_LABELS: Record<string, string> = {
  server: "服务器端",
  client: "客户端",
  both: "两者都可以",
};
```

---

### 2. 创建/编辑页面

#### frontend/src/app/skills/new/page.tsx

```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { api, CAPABILITY_LABELS, EXECUTION_MODE_LABELS } from "@/lib/api";

// ... 现有代码 ...

export default function NewSkillPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  // 新增状态 - 执行属性
  // 注意：dependencies 在版本上传时设置，因为依赖是版本级别的
  const [executionMode, setExecutionMode] = useState<"server" | "client" | "both">("both");
  const [requiresGui, setRequiresGui] = useState(false);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [skillUuid, setSkillUuid] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const allCapabilities = Object.keys(CAPABILITY_LABELS);

  const handleCreate = async () => {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const skill = await api.createSkill({
      name,
      description: description || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    setSkillUuid(skill.id);
    setMessage("Skill 已创建，可以配置执行属性或上传文件");
  };

  const handleUpload = async () => {
    if (!file || !skillUuid) return;
    setUploading(true);
    try {
      await api.uploadSkillFile(skillUuid, file);
      router.push(`/skills/${skillUuid}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateExecutionProperties = async () => {
    if (!skillUuid) return;

    await api.updateSkill(skillUuid, {
      execution_mode: executionMode !== "both" ? executionMode : undefined,
      requires_gui: requiresGui ? true : undefined,
      client_capabilities: selectedCapabilities.length > 0 ? selectedCapabilities : undefined,
    });
    setMessage("执行属性已保存");
  };

  const toggleCapability = (capability: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(capability)
        ? prev.filter((c) => c !== capability)
        : [...prev, capability]
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/skills">返回列表</Link>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="execution">执行属性</TabsTrigger>
          <TabsTrigger value="upload" disabled={!skillUuid}>上传文件</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>创建 Skill</CardTitle>
              <CardDescription>填写 Skill 的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-skill"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Skill 的描述"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">标签（逗号分隔）</Label>
                <Input
                  id="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-2">
              <Button onClick={handleCreate} disabled={!name.trim()}>
                创建 Skill
              </Button>
              {message && (
                <p className="text-sm text-muted-foreground">{message}</p>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="execution">
          <Card>
            <CardHeader>
              <CardTitle>执行属性</CardTitle>
              <CardDescription>配置 Skill 的执行方式和需求</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="execution-mode">执行模式</Label>
                <Select
                  value={executionMode}
                  onValueChange={(value: "server" | "client" | "both") =>
                    setExecutionMode(value)
                  }
                >
                  <SelectTrigger id="execution-mode">
                    <SelectValue placeholder="选择执行模式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">
                      {EXECUTION_MODE_LABELS.both}
                    </SelectItem>
                    <SelectItem value="server">
                      {EXECUTION_MODE_LABELS.server}
                    </SelectItem>
                    <SelectItem value="client">
                      {EXECUTION_MODE_LABELS.client}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {executionMode === "server"
                    ? "此 Skill 必须在服务器端运行，通过 MCP 接口调用"
                    : executionMode === "client"
                    ? "此 Skill 必须在客户端本地运行，需要下载后执行"
                    : "此 Skill 可以在服务器端或客户端运行"}
                </p>
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requires-gui"
                  checked={requiresGui}
                  onCheckedChange={(checked) =>
                    setRequiresGui(checked as boolean)
                  }
                />
                <div>
                  <Label htmlFor="requires-gui">需要 GUI 环境</Label>
                  <p className="text-sm text-muted-foreground">
                    此 Skill 执行时需要图形用户界面（如浏览器、桌面应用）
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>客户端能力要求</Label>
                <p className="text-sm text-muted-foreground">
                  选择此 Skill 执行时客户端需要具备的能力
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {allCapabilities.map((capability) => (
                    <div
                      key={capability}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`cap-${capability}`}
                        checked={selectedCapabilities.includes(capability)}
                        onCheckedChange={() => toggleCapability(capability)}
                      />
                      <Label htmlFor={`cap-${capability}`}>
                        {CAPABILITY_LABELS[capability]}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedCapabilities.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-1">已选择：</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedCapabilities.map((capability) => (
                        <Badge key={capability} variant="secondary">
                          {CAPABILITY_LABELS[capability]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpdateExecutionProperties} disabled={!skillUuid}>
                保存执行属性
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          {/* ... 现有的上传文件部分 ... */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### 3. Skill 列表页

#### frontend/src/app/skills/page.tsx

```tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { api, Skill, CAPABILITY_LABELS, EXECUTION_MODE_LABELS } from "@/lib/api";

// ... 现有代码 ...

function ExecutionModeBadge({ mode }: { mode: string }) {
  const variant =
    mode === "server"
      ? "default"
      : mode === "client"
      ? "secondary"
      : "outline";
  return <Badge variant={variant}>{EXECUTION_MODE_LABELS[mode]}</Badge>;
}

function GuiBadge({ requiresGui }: { requiresGui: boolean }) {
  if (!requiresGui) return null;
  return <Badge variant="destructive">需要 GUI</Badge>;
}

function CapabilitiesBadges({ capabilities }: { capabilities: string[] }) {
  if (capabilities.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {capabilities.map((cap) => (
        <Badge key={cap} variant="outline" className="text-xs">
          {CAPABILITY_LABELS[cap]}
        </Badge>
      ))}
    </div>
  );
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [query, setQuery] = useState("");

  // ... 现有代码 ...

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Skills</h1>
          <p className="text-muted-foreground">管理和查看你的 Skill</p>
        </div>
        <Link href="/skills/new">
          <Button>创建 Skill</Button>
        </Link>
      </div>

      <div className="mb-6">
        <Input
          placeholder="搜索 Skill..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {status === "loading" ? (
        <div>加载中...</div>
      ) : status === "idle" && skills.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>暂无 Skill</CardTitle>
            <CardDescription>创建你的第一个 Skill 开始使用</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/skills/new">
              <Button>创建 Skill</Button>
            </Link>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => {
            const skillUuid = skill.id;
            return (
              <Card key={skill.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{skill.name}</CardTitle>
                      <CardDescription>
                        {skill.description || "暂无描述"}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ExecutionModeBadge mode={skill.execution_mode} />
                      <GuiBadge requiresGui={skill.requires_gui} />
                    </div>
                  </div>
                  <CapabilitiesBadges capabilities={skill.client_capabilities} />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {skill.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    <Badge variant="outline">id: {skill.id.slice(0, 8)}</Badge>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Link href={`/skills/${skill.id}`}>
                    <Button variant="secondary">查看</Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">删除</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                          确定要删除 Skill "{skill.name}" 吗？此操作不可撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(skill.id)}>
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

### 4. Skill 详情页

#### frontend/src/app/skills/[skillUuid]/page.tsx

```tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { api, Skill, CAPABILITY_LABELS, EXECUTION_MODE_LABELS } from "@/lib/api";

// ... 现有代码 ...

function ExecutionModeInfo({ skill }: { skill: Skill }) {
  const getDescription = () => {
    switch (skill.execution_mode) {
      case "server":
        return "此 Skill 必须在服务器端运行，通过 MCP 接口调用。";
      case "client":
        return "此 Skill 必须在客户端本地运行，需要下载后执行。";
      case "both":
      default:
        return "此 Skill 可以在服务器端或客户端运行。";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">执行模式：</span>
        <Badge
          variant={
            skill.execution_mode === "server"
              ? "default"
              : skill.execution_mode === "client"
              ? "secondary"
              : "outline"
          }
        >
          {EXECUTION_MODE_LABELS[skill.execution_mode]}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{getDescription()}</p>
    </div>
  );
}

function GuiRequirementInfo({ skill }: { skill: Skill }) {
  if (!skill.requires_gui) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">GUI 要求：</span>
          <Badge variant="outline">不需要</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          此 Skill 不需要图形用户界面，可以在任何环境运行。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">GUI 要求：</span>
        <Badge variant="destructive">需要</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        此 Skill 执行时需要图形用户界面。
        {skill.execution_mode === "server" &&
          " 在服务器端运行时需要使用 headless 模式。"}
        {skill.execution_mode === "client" &&
          " 请确保客户端有桌面环境。"}
      </p>
    </div>
  );
}

function ClientCapabilitiesInfo({ skill }: { skill: Skill }) {
  if (skill.client_capabilities.length === 0) {
    return (
      <div className="space-y-2">
        <div className="font-medium">客户端能力要求：</div>
        <p className="text-sm text-muted-foreground">无特殊要求</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="font-medium">客户端能力要求：</div>
      <div className="flex flex-wrap gap-2">
        {skill.client_capabilities.map((cap) => (
          <Badge key={cap} variant="outline">
            {CAPABILITY_LABELS[cap]}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function SkillDetailPage({
  params,
}: {
  params: { skillUuid: string };
}) {
  const [skill, setSkill] = useState<Skill | null>(null);
  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  // ... 现有代码 ...

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/skills">返回列表</Link>
      </div>

      {status === "loading" ? (
        <div>加载中...</div>
      ) : !skill ? (
        <div>未找到 Skill</div>
      ) : (
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">基本信息</TabsTrigger>
            <TabsTrigger value="execution">执行属性</TabsTrigger>
            <TabsTrigger value="files">文件</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>{skill.name}</CardTitle>
                <CardDescription>{skill.description || "暂无描述"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ... 现有的基本信息部分 ... */}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="execution">
            <Card>
              <CardHeader>
                <CardTitle>执行属性</CardTitle>
                <CardDescription>此 Skill 的执行方式和要求</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ExecutionModeInfo skill={skill} />
                <Separator />
                <GuiRequirementInfo skill={skill} />
                <Separator />
                <ClientCapabilitiesInfo skill={skill} />

                {skill.execution_mode === "client" && (
                  <>
                    <Separator />
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2">💡 提示</h4>
                      <p className="text-sm text-muted-foreground">
                        此 Skill 需要在客户端运行。请使用下载功能获取 ZIP 包，
                        然后在本地解压并执行。
                      </p>
                    </div>
                  </>
                )}

                {skill.requires_gui && skill.execution_mode === "server" && (
                  <>
                    <Separator />
                    <div className="bg-warning/10 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">⚠️ 注意</h4>
                      <p className="text-sm text-muted-foreground">
                        此 Skill 在服务器端运行时需要 GUI 环境，请确保服务器配置了
                        headless 模式或虚拟显示器。
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            {/* ... 现有的文件部分 ... */}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

---

## MCP 资源接口扩展

### skill:// 资源 URI 扩展

```typescript
// 技能列表资源
GET skill://list

// 响应扩展，包含执行属性
{
  "contents": [{
    "uri": "skill://list",
    "mimeType": "application/json",
    "text": JSON.stringify({
      "skills": [
        {
          "skill_id": "8b3b0f59-72ce-4f5f-9d30-4f6ae4f0f9ab",
          "name": "browser-agent",
          "description": "...",
          "execution_mode": "client",
          "requires_gui": true,
          "client_capabilities": ["browser", "screen_capture"]
        }
      ]
    })
  }]
}

// 技能详情资源
GET skill://{skill_uuid}@{version}

// 响应扩展
{
  "contents": [{
    "uri": "skill://8b3b0f59-72ce-4f5f-9d30-4f6ae4f0f9ab@1.0.0",
    "mimeType": "application/json",
    "text": JSON.stringify({
      "skill_id": "8b3b0f59-72ce-4f5f-9d30-4f6ae4f0f9ab",
      "version": "1.0.0",
      "name": "browser-agent",
      "description": "...",
      "execution_mode": "client",
      "requires_gui": true,
      "client_capabilities": ["browser", "screen_capture"],
      "download_hint": "Use /api/v1/skills/download to get this skill"
    })
  }]
}
```

### execute_skill 工具错误码扩展

```typescript
// 执行 client-only Skill 时返回的错误
{
  "result": {
    "status": "error",
    "error_code": "SKILL_REQUIRES_CLIENT_MODE",
    "error_message": "This skill requires client-side execution. Please download it using /api/v1/skills/download",
    "download_url": "/api/v1/skills/download",
    "skill_uuid": "8b3b0f59-72ce-4f5f-9d30-4f6ae4f0f9ab"
  }
}
```

---

## 实施计划

### Phase 1: 后端基础（高优先级）

| 任务 | 说明 | 依赖 |
|------|------|------|
| 创建数据库迁移 | 添加新字段到 skills 表 | 无 |
| 扩展 Skill 模型 | 添加 execution_mode、requires_gui、client_capabilities | 迁移 |
| 扩展 Schema | 更新 SkillCreate、SkillUpdate、SkillResponse | 模型 |
| 修改 execute_skill | 验证 execution_mode | 模型 |

### Phase 2: 前端展示（中优先级）

| 任务 | 说明 | 依赖 |
|------|------|------|
| 更新 API 类型 | 添加新字段的 TypeScript 定义 | Phase 1 |
| 修改列表页 | 显示执行属性 Badge | API 类型 |
| 修改详情页 | 展示执行属性详情 | 列表页 |
| 修改创建页 | 添加执行属性表单 | 详情页 |

### Phase 3: 完善和测试（低优先级）

| 任务 | 说明 | 依赖 |
|------|------|------|
| 单元测试 | 验证新字段的验证逻辑 | Phase 1 |
| 集成测试 | 验证完整流程 | Phase 2 |
| 文档更新 | 更新 user guide | 全部 |

---

## 安全考虑

1. **验证规则**：严格验证 `execution_mode`、`client_capabilities` 的值，防止注入
2. **权限控制**：`skill.download` 权限独立于 `skill.execute`，可以分别控制
3. **审计日志**：记录 `skill.download` 操作，包含 `execution_mode` 信息
4. **降级策略**：老 Skill 自动使用默认值，保持向后兼容

---

## 向后兼容性

1. **默认值**：新增字段都有合理的默认值
   - `dependencies = []`（已在 `skill_versions` 表中实现）
   - `execution_mode = "both"`
   - `requires_gui = false`
   - `client_capabilities = []`

2. **老数据处理**：数据库迁移时使用 `server_default`，老 Skill 自动获得默认值

3. **老客户端兼容**：MCP 资源响应中新增字段是可选的，老客户端忽略即可

4. **SKILL.md 解析不变**：SKILL.md Frontmatter 解析逻辑只处理 name、description、version，保持原有行为

---

## 设计原则总结

### 为什么依赖存储在版本表、执行属性存储在 Skill 表？

1. **关注点分离**：
   - SKILL.md 负责描述 Skill 的内容、功能（仅包含 name、description、version）
   - 数据库字段负责 Skill 的元数据、执行配置、运行时属性
   - `dependencies` 存储在 `skill_versions` 表（版本级别依赖）
   - 执行属性存储在 `skills` 表（Skill 级别属性）

2. **灵活性**：
   - 用户可以在不修改 SKILL.md 的情况下更改执行属性
   - 每个版本可以有独立的依赖，便于版本管理和回滚
   - 可以通过 API 批量更新多个 Skill 的执行属性
   - 便于未来的权限控制和策略管理

3. **可查询性**：
   - 可以根据 `execution_mode` 过滤 Skill
   - 可以根据 `client_capabilities` 匹配客户端能力
   - 可以根据 `dependencies` 查询依赖特定库的版本
   - 数据库索引可以提高查询性能

4. **版本控制**：
   - SKILL.md 的版本变化不影响执行属性
   - `dependencies` 跟随版本变化，不同版本可有不同依赖
   - 执行属性的变更可以单独追踪和审计

---

## 总结

本文档完整定义了 SKILL 模块的四个核心执行属性：
- `dependencies`：存储在 `skill_versions` 表，版本级别依赖
- `execution_mode`、`requires_gui`、`client_capabilities`：存储在 `skills` 表，Skill 级别属性

通过将依赖存储在版本表、执行属性存储在 Skill 表，实现了：
1. **版本独立性**：不同版本可以有不同依赖
2. **关注点分离**：SKILL.md 只包含内容描述，元数据在数据库中管理
3. **灵活性和可查询性**：便于管理和查询

整个设计遵循以下核心原则：
1. **向后兼容**：所有新增字段都有合理默认值，确保老数据和老客户端正常运行
2. **严格验证**：所有输入都经过严格验证，防止恶意数据注入
3. **渐进式实施**：分为三个阶段逐步实施，降低风险
4. **清晰的用户体验**：前端提供直观的 Badge 和提示，帮助用户理解 Skill 的执行需求

该设计为 Skill 平台提供了坚实的基础，可以支持未来的权限控制、能力匹配、智能推荐等高级功能。
