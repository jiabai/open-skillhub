# 本地 SKILL 卡片精简：从 Frontmatter 读取 name 与 description

## 背景

桌面客户端「本地 SKILL」列表（`desktop-client/src/components/local-skills-view.tsx`）的每行卡片当前展示了名称、本地路径、服务端状态徽章、来源代理、本地/远程版本、远程 ID、校验提示等一大堆元信息。每行上的「查看 {name}」按钮只是把该行选中，在右侧详情面板里把这些信息再铺开一遍，导致「查看某个 SKILL」几乎不提供任何新增信息，按钮显得冗余。

同时，本地库存服务（`local-skill-inventory-service.ts`）解析 `SKILL.md` Frontmatter 时只取出 `name`、`slug`、`version`，从未读取 `description`，因此列表卡片上没有 SKILL 的描述。

用户期望：**卡片只展示从 `SKILL.md` Frontmatter 读取的 `name` 与 `description`**，把其余元信息收进「查看」打开的详情面板，让查看动作重新具备价值。

## 目标

1. 在 SKILL.md Frontmatter 解析中加入 `description` 字段，并沿用到库存行数据。
2. 精简本地 SKILL 列表卡片：内容只展示 skill 的 `name` 与 `description`。
3. 把原卡片上的路径、版本、来源代理、远程 ID、校验等元信息收进「查看」详情面板；详情面板同时展示 `description`。

## 非目标（不包含）

- 不新增「启用/停用」按钮或任何服务端 `is_active` 联动（用户已明确暂缓该功能）。
- 不改变 Web 控制台 `frontend/` 的任何代码。
- 不修改上传/删除/打开目录等回调逻辑与 IPC 契约。
- 不把 `parseSkillFrontmatter` 升级为完整 YAML 解析器（保持现有简单行解析）。

## 功能需求

### FR-1：数据层读取 description
- `ParsedSkillMetadata` 增加 `description: string | null`。
- `parseSkillFrontmatter` 在字段表中增加 `description`，取值 `fields.get("description") ?? null`。
- `LocalSkillInventoryRow`（`desktop-client/src/types/index.ts`）增加 `description?: string | null`。
- `buildRow` 返回的行中写入解析出的 `description`。
- 群组对象沿用 `primary.description`；视图从 `group.primary.description` 读取，无需扩展 `LocalSkillGroupRow`。

### FR-2：列表卡片精简
卡片保留：
- skill `name`（标题）+ `description`（新增，超长省略号截断；无描述时显示占位文案）。
- 服务端状态徽章与「多路径」徽章（状态提示，驱动上传工作流）。
- 右侧操作按钮（查看 / 打开目录 / 上传 / 删除）。

卡片移除（全部移到详情面板）：
- 本地路径行（`copy.localPath`）。
- `update-item__meta` 元信息行（来源代理、本地版本、远程版本、远程 ID、版本冲突、校验提示）。

### FR-3：详情面板补全
- `local-skills-detail` 的 facts 区域顶部新增 `description` 一行（含占位文案）。
- 保留现有的本地版本 / 远程版本 / 服务端状态 / 校验状态、路径列表等全部信息。

### FR-4：国际化
- `localSkillsView` 段新增 `noDescription`（中英：`暂无描述` / `No description`）与 `descriptionLabel`（`描述` / `Description`），写入 `desktop-client/src/i18n/messages/{zh-CN,en-US}.ts` 并同步 `types.ts`。

## 非功能需求

- 不引入新的第三方依赖。
- description 展示使用现有 CSS 变量与行内省略逻辑，新增一个 `.local-skill-item__description` 小样式即可。
- `cd desktop-client && npm test`、`npm run build`、`npm run typecheck:electron` 通过。

## 约束条件

- 仅修改 `desktop-client/` 目录内文件。
- 遵循 `desktop-client/docs/DESIGN.md` 视觉规范与 i18n 约定。
- 不改变 `parseSkillFrontmatter` 的行解析语义：description 取 Frontmatter 单行值；多行 YAML 描述块仅保留首行（与现有 name/version 处理一致，作为已知局限记录）。

## 验收标准

- [ ] 本地 SKILL 卡片内容只剩 name + description（外加状态徽章与操作按钮）。
- [ ] 卡片不再显示路径与版本/来源/远程 ID 等元信息行。
- [ ] 「查看 {name}」打开的详情面板能显示 description，并保留全部元信息。
- [ ] 库存行解析带 `description`，无 description 时为 null 并展示占位文案。
- [ ] 中英 i18n 文案存在、类型无报错。
- [ ] `npm test`、`npm run build`、`npm run typecheck:electron` 通过。