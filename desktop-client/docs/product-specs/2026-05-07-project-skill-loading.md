# 项目 Skills 管理 — Desktop 产品设计稿

## 设计背景

原始功能说明（`project_skill_loading.md`）描述了"添加项目 → 自动加载项目 Skills"的核心流程，但其 UI 设想（左侧边栏 + 独立详情页 + 右键菜单）与 desktop-client 现有的设计体系不兼容。Desktop-client 采用**顶部导航标签页 + 平铺视图**的架构，设计语言遵循"review-first sync utility"而非"第二管理后台"。本设计稿在保留核心功能意图的前提下，将其重塑为适配 desktop-client 现有体系的产品方案。

---

## 1. 导航与信息架构

### 1.1 入口位置

在现有顶部导航栏新增 **"Projects"** 标签页，与 Home / Local Skills / Updates 并列：

```
[ Home ]  [ Local Skills ]  [ Updates ]  [ Projects ]
```

### 1.2 视图层级

```
Projects（项目列表）
  └─ 点击项目 → 项目详情（内嵌子视图，替换当前 Projects 列表）
       └─ Skills 列表（项目级 + 全局合并，标注来源）
```

项目详情不跳转到独立页面，而是在 Projects 视图内做**列表→详情的就地切换**，顶部保留面包屑导航（`Projects > 项目名称`）和返回按钮。这与 desktop-client 当前"平铺视图、避免深层路由"的架构原则一致。

---

## 2. 视图设计

### 2.1 Projects 列表视图

**布局**：使用现有 `page-stack` 布局，顶部 `PageIntro` + 下方项目卡片网格。

```
┌──────────────────────────────────────────────────┐
│  PageIntro                                       │
│  eyebrow: "Projects"                             │
│  title: "Project skills"                         │
│  summary: "Add local projects to manage their    │
│            agent skills."                        │
│                        [ + Add Project ]  Button  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ Project Card │  │ Project Card │              │
│  │              │  │              │              │
│  │ my-app       │  │ backend-svc  │              │
│  │ D:\code\...  │  │ D:\code\...  │              │
│  │ 3 skills     │  │ 1 skill      │              │
│  │ [Open] [···] │  │ [Open] [···] │              │
│  └──────────────┘  └──────────────┘              │
│                                                  │
│  ┌──────────────┐                                │
│  │ + Add        │  (空状态 / 添加入口卡片)        │
│  └──────────────┘                                │
│                                                  │
└──────────────────────────────────────────────────┘
```

**项目卡片内容**：
- 项目名称（可编辑内联）
- 项目路径（截断显示，`mono` 字体）
- Skills 数量 Badge
- 操作按钮：`Open`（进入详情）、`···`（更多操作：Rename / Remove）

**空状态**：当无项目时，显示引导性空状态卡片，内含 `+ Add your first project` 按钮。

### 2.2 添加项目对话框

复用现有 `Dialog` 组件，保持与 Settings 抽屉一致的视觉风格。

```
┌─────────────────────────────────────┐
│  Add Project                    [X] │
│                                     │
│  Add a local project to manage its  │
│  agent skills and configurations.   │
│                                     │
│  Project Name                       │
│  ┌─────────────────────────────┐    │
│  │ my-awesome-project          │    │
│  └─────────────────────────────┘    │
│                                     │
│  Project Folder                     │
│  ┌─────────────────────────────┐    │
│  │ D:\code\my-awesome-project  │ [📁]│
│  └─────────────────────────────┘    │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ ⚠ No agent config detected    │ │
│  │   This folder doesn't contain  │ │
│  │   .claude/, .mcp.json, or     │ │
│  │   other recognized agent dirs. │ │
│  └────────────────────────────────┘ │
│                                     │
│            [ Cancel ]  [ Add ]      │
└─────────────────────────────────────┘
```

**交互细节**：
- 选择文件夹后自动填充项目名称（取文件夹名），可手动修改
- 选择文件夹后即时检测是否存在 agent 配置文件（`.claude/`、`.mcp.json`、`.opencode/` 等），若无则显示温和的 info 提示（非阻塞，仍可添加）
- 项目名称不可为空，不可与已有项目重名
- 点击 `Add` 后关闭对话框，项目卡片出现在列表中

### 2.3 项目详情视图

点击项目卡片 `Open` 后，Projects 列表视图切换为该项目详情。

```
┌──────────────────────────────────────────────────┐
│  ← Back to Projects                              │
│                                                  │
│  PageIntro                                       │
│  eyebrow: "Project"                              │
│  title: "my-app"                                 │
│  summary: "D:\code\my-app"                       │
│              [ Open Folder ]  [ Remove ]          │
├──────────────────────────────────────────────────┤
│                                                  │
│  Skills (3)                                      │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │ Skill Item                    source: project││
│  │ deployment-helper                            ││
│  │ v1.2.0  ·  .claude/skills/deployment-helper  ││
│  │                                    [View] [···]││
│  ├──────────────────────────────────────────────┤│
│  │ Skill Item                    source: global  ││
│  │ code-review                                  ││
│  │ v2.0.0  ·  ~/.skilldrive/skills/code-review  ││
│  │                                    [View] [···]││
│  ├──────────────────────────────────────────────┤│
│  │ Skill Item                    source: project││
│  │ api-docs-generator                           ││
│  │ v0.5.0  ·  .claude/skills/api-docs-generator ││
│  │                                    [View] [···]││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  [+ Add Skill to Project]                        │
│                                                  │
└──────────────────────────────────────────────────┘
```

**详情页结构**：
- **面包屑**：`← Back to Projects` 返回按钮
- **PageIntro**：项目名称 + 路径 + 操作按钮（Open Folder、Remove）
- **Skills 列表**：复用 `update-item` 样式，每项显示名称、版本、来源标记、路径、操作按钮
- **底部操作**：`+ Add Skill to Project` 按钮

**来源标记**：每个资源项通过 Badge 区分来源：
- `project` — 蓝色/强调色 Badge，表示来自当前项目目录
- `global` — 中性 Badge，表示来自全局 SkillDrive 目录

### 2.4 导入 Skill 到项目

在项目详情页点击 `[+ Add Skill to Project]`，弹出导入对话框。

```
┌──────────────────────────────────────────────┐
│  Add Skill to my-app                     [X] │
│                                              │
│  Import a skill folder from a local agent    │
│  skills directory into this project.         │
│                                              │
│  Skill Folder                                │
│  ┌──────────────────────────────────────┐    │
│  │ D:\code\.claude\skills\deploy-helper │ [📁]│
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ ✓ Valid skill folder detected           │ │
│  │                                         │ │
│  │   deploy-helper                         │ │
│  │   v1.2.0                                │ │
│  │   Deploy the current project to cloud.  │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ ⚠ A skill named "deploy-helper"        │ │
│  │   already exists in this project.       │ │
│  │   Importing will overwrite it.          │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Target Agent                                │
│  ┌──────────────────────────────────────┐    │
│  │ Claude Code  (.claude/skills/)    ▼  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│              [ Cancel ]  [ Import ]          │
└──────────────────────────────────────────────┘
```

**交互细节**：

- **选择 Skill 文件夹**：点击文件夹选择器，用户浏览本地文件系统，选择某个 agent skills 目录下的 skill 文件夹（如 `D:\code\.claude\skills\deploy-helper`）
- **即时校验**：选择文件夹后自动检测：
  - 是否包含有效的 `SKILL.md` 文件
  - 解析 skill 名称和版本（从 frontmatter 或目录名推断）
  - 显示 skill 预览卡片（名称、版本、描述）
- **重名检测**：如果项目中已存在同名 skill，显示警告提示（非阻塞，用户确认后覆盖）
- **选择目标 Agent**：下拉选择将 skill 写入项目下哪个 agent 的 skills 目录（如 `.claude/skills/`、`.opencode/skills/`），选项来自项目目录下已检测到的 agent 配置
- **导入操作**：点击 `Import` 后，将 skill 文件夹复制到 `<project>/.claude/skills/<skill-name>/`（或对应 agent 目录），然后刷新 Skills 列表

**校验状态**：

| 状态 | 表现 |
|------|------|
| 未选择 | 预览区域为空，`Import` 按钮禁用 |
| 有效 skill | 显示绿色校验结果 + skill 预览，`Import` 可用 |
| 缺少 SKILL.md | 显示黄色警告"Selected folder does not contain SKILL.md"，`Import` 禁用 |
| 重名 | 显示黄色警告，`Import` 仍可用（确认后覆盖） |

### 2.5 移除项目确认

使用现有 `Dialog` 组件：

```
┌─────────────────────────────────────┐
│  Remove Project                 [X] │
│                                     │
│  Remove "my-app" from the project   │
│  list?                              │
│                                     │
│  This will not delete the project   │
│  folder or its files.               │
│                                     │
│            [ Cancel ]  [ Remove ]   │
└─────────────────────────────────────┘
```

---

## 3. 组件映射

所有 UI 均使用 desktop-client 现有组件，不引入新依赖：

| 功能 | 使用组件 |
|------|---------|
| 视图容器 | `page-stack` CSS class |
| 页面标题区 | `PageIntro` |
| 项目卡片 | `Card` + `CardContent` |
| 添加/确认对话框 | `Dialog` |
| 资源列表项 | `update-item` CSS class |
| 标签/来源标记 | `Badge` |
| 所有按钮 | `Button`（variant: primary/secondary/outline/ghost/destructive） |
| 面包屑返回 | `Button` variant="ghost" |
| 内联编辑 | 标准 `<input>` + 失焦/回车保存 |

---

## 4. 数据流

### 4.1 项目持久化

项目列表存储在 `config/projects.json`（与 `config/config.json` 同级），通过 `config-store.ts` 扩展读写：

```typescript
// 新增类型
interface ProjectEntry {
  id: string        // uuid
  name: string
  path: string      // 绝对路径
  addedAt: string   // ISO 时间戳
}
```

### 4.2 IPC 通道

新增以下 IPC 通道（遵循现有 `ipc.ts` 命名规范，动词描述操作）：

| 通道 | 方向 | 用途 |
|------|------|------|
| `project:list` | renderer → main | 获取项目列表 |
| `project:add` | renderer → main | 添加项目（name + path） |
| `project:remove` | renderer → main | 移除项目（id） |
| `project:rename` | renderer → main | 重命名项目（id + name） |
| `project:scan-skills` | renderer → main | 扫描项目目录下的 Skills |
| `project:import-skill` | renderer → main | 导入 skill 文件夹到项目（projectId + sourcePath + targetAgent） |
| `project:validate-skill-folder` | renderer → main | 校验文件夹是否为有效 skill（返回名称、版本、描述） |
| `project:open-folder` | renderer → main | 在系统文件管理器中打开项目路径 |

### 4.3 扫描流程

```
用户进入项目详情
  → renderer 调用 project:scan-skills（传入 projectRoot）
  → main 进程扫描 projectRoot 下的 agent 配置目录
     （.claude/skills/, .opencode/skills/ 等）
  → 同时读取全局 Skills（来自 SkillDrive 本地目录）
  → 合并返回 { skills: [...] }
     （每项带 source: "project" | "global"）
  → renderer 展示合并后的 Skills 列表
```

扫描逻辑复用现有 `agent-detection-service.ts` 的目录探测能力，扩展为可指定 `projectRoot` 参数。详细路径解析机制见 [第 8 节](#8-skills-路径解析机制)。

### 4.4 导入 Skill 流程

```
用户点击 [+ Add Skill to Project]
  → 弹出导入对话框
  → 用户选择 skill 文件夹
  → renderer 调用 project:validate-skill-folder（传入 sourcePath）
  → main 进程校验：
      · 是否存在 SKILL.md
      · 解析 frontmatter 获取 name / version / description
      · 检测项目中是否已有同名 skill
  → 返回 { valid, name, version, description, conflict }
  → renderer 展示校验结果和 skill 预览
  → 用户选择目标 Agent，点击 Import
  → renderer 调用 project:import-skill（传入 projectId + sourcePath + targetAgent）
  → main 进程将 skill 文件夹复制到 <project>/<agent-skills-dir>/<skill-name>/
  → 返回成功，renderer 刷新 Skills 列表
```

---

## 5. 视觉规范

### 5.1 设计令牌

全部沿用 `styles.css` 中定义的 CSS 自定义属性（`--osh-*`），无需新增令牌：

- 卡片背景：`--osh-card` / `--osh-card-strong`
- 主色调：`--osh-primary` / `--osh-primary-soft`
- 文字色：`--osh-foreground` / `--osh-muted`
- 边框：`--osh-border` / `--osh-border-strong`
- 圆角：`--osh-radius` / `--osh-radius-sm`

### 5.2 暗色模式

所有新增 UI 自动适配暗色模式——因为全部使用 `--osh-*` 令牌，而 `.dark` 已定义了对应的暗色值。无需额外处理。

### 5.3 字体

- 标题：`--osh-font-display`（Fraunces / Georgia）
- 正文：`--osh-font-body`（IBM Plex Sans / Segoe UI）
- 路径/代码：`--osh-font-mono`（SFMono / Consolas）

---

## 6. 交互规则

| 规则 | 说明 |
|------|------|
| 不自动扫描 | 用户必须主动添加项目，不会自动发现磁盘上的项目 |
| 不修改项目文件 | 所有操作（添加/删除 Skill、查看详情）均为只读或写入 SkillDrive 管理目录，不修改项目源文件 |
| 移除不删文件 | Remove 仅从列表中移除，不触碰项目文件夹 |
| 即时反馈 | 添加/移除项目后列表即时更新，无需手动刷新 |
| 错误可恢复 | 路径不可访问时显示警告状态而非崩溃，允许用户编辑路径或移除项目 |

---

## 7. 与原始设计的差异总结

| 原始设计 | 适配后设计 | 原因 |
|---------|-----------|------|
| 左侧边栏 Projects 区域 | 顶部导航 "Projects" 标签页 | desktop-client 使用顶部导航，无侧边栏 |
| 独立项目详情页 | Projects 视图内就地切换（列表↔详情） | 遵循平铺视图架构，避免深层路由 |
| 右键菜单 Remove | 卡片内 `···` 按钮菜单 / 详情页 Remove 按钮 | desktop-client 无右键菜单模式 |
| 未指定组件 | 全部映射到现有组件（Card, Dialog, Badge, Button, PageIntro） | 复用现有组件库，保持视觉一致性 |
| 无暗色模式 | 通过 `--osh-*` 令牌自动适配 | 遵循 DESIGN.md 暗色模式规范 |
| scope/source 后端过滤 | 前端按 source 字段过滤 + 子标签切换 | 简化数据流，前端负责视图过滤 |
| 未定义持久化格式 | `config/projects.json`，扩展 config-store | 与现有 config.json 模式一致 |

---

## 8. Skills 路径解析机制

### 8.1 路径公式

Skill 在项目中的存放路径由 **目标 Agent** + **项目根目录** 决定：

```
<project_root>/<agent专属目录>/skills/<skill-name>/SKILL.md
```

例如，选择 Claude Code agent，项目根目录为 `D:\code\my-app`：

```
D:\code\my-app\.claude\skills\deploy-helper\SKILL.md
```

### 8.2 各 Agent 项目 Skills 写入路径

桌面端支持的 21 个 agent 中，有 4 个不支持项目级 skills（无项目写入路径），其余 17 个的路径如下：

| Agent | 项目写入路径 | 备注 |
|-------|-------------|------|
| Claude Code | `.claude/skills` | |
| Codex | `.agents/skills` | |
| OpenCode | `.opencode/skills` | 读取时还扫描 `.claude/skills`、`.agents/skills` |
| Gemini CLI | `.agents/skills` | |
| Cline | `.agents/skills` | |
| Copilot | `.agents/skills` | |
| Cursor | `.cursor/skills` | 读取时还扫描 `.agents/skills`、`.claude/skills`、`.codex/skills` |
| Antigravity | `.agents/skills` | |
| Kiro | `.kiro/skills` | |
| Windsurf | `.windsurf/skills` | |
| Trae | `.trae/skills` | |
| RooCode | `.roo/skills` | |
| Kimi | `.agents/skills` | `universal: true`，额外读取通用 `.agents/skills` |
| Mistral | `.vibe/skills` | |
| Pi | `.pi/skills` | |
| KiloCode | `.kilocode/skills` | |
| Amp | `.agents/skills` | `universal: true`，额外读取通用 `.agents/skills` |
| Warp | `.agents/skills` | |
| Factory | `.factory/skills` | |
| CodeBuddy | `.codebuddy/skills` | 待添加 |
| OpenClaw | 不支持 | 无项目写入路径 |
| Zed | 不支持 | 无项目写入路径 |
| JetBrains AI | 不支持 | 无项目写入路径 |
| AugmentCode | 不支持 | 无项目写入路径 |

**对 UI 的影响**：
- 导入对话框的 **Target Agent 下拉** 只列出项目目录下已检测到的、且支持项目级 skills 的 agent
- 不支持项目写入的 agent（OpenClaw、Zed、JetBrains AI、AugmentCode）不出现在下拉选项中

### 8.3 Skill 发现（读取）机制

进入项目详情时，扫描流程如下：

1. 遍历项目根目录下已检测到的 agent 配置目录
2. 对每个 agent，读取其 `project_skill_read_paths`（可能包含多个路径）：
   - **Agent 专属路径**：如 Claude 的 `.claude/skills`
   - **通用回退路径**：仅 `universal: true` 的 agent（Kimi、Amp）额外读取 `.agents/skills`
3. 递归扫描每个路径下的子目录，寻找 `SKILL.md` 文件
4. 同名 skill 按目录扫描顺序 **先到先得**（第一个发现的版本被保留）

### 8.4 合并优先级

项目 Skills 与全局 Skills 合并展示时：

- 先加载项目 Skills，再加载全局 Skills
- 按名称去重，**项目 Skills 优先于全局 Skills**
- 即：如果项目目录和全局目录中存在同名 skill，只展示项目版本

### 8.5 全局通用路径

桌面端的全局 Skills 来自 SkillDrive 本地目录（由现有 `local-skill-inventory-service.ts` 管理），对应 agHub 中的 XDG 通用路径概念：

```
~/.config/agents/skills   (Linux / macOS)
%APPDATA%/agents/skills   (Windows)
```

此路径由现有 `app-paths.ts` 和 `local-skill-inventory-service.ts` 管理，本节功能无需额外处理。

