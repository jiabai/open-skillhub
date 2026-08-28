# 本地 SKILL 卡片精简（Frontmatter name/description）— 执行计划

- 关联 spec：`docs/product-specs/2026-08-28-local-skill-frontmatter-description.md`
- 状态：已归档（完成）
- 范围：仅 `desktop-client/`

## 目标

用户反馈本地 SKILL 列表卡片信息过满、且「查看」按钮展示的信息与卡片重复。方案：卡片只展示从 `SKILL.md` Frontmatter 读取的 name 与 description；路径/版本/来源/远程 ID/校验等元信息收进详情面板。

## 待改动文件

| 文件 | 改动要点 |
|------|---------|
| `desktop-client/src/core/local-skills/local-skill-inventory-service.ts` | `ParsedSkillMetadata` 增 `description`；`parseSkillFrontmatter` 读取 `description`；`buildRow` 行数据写入 `description` |
| `desktop-client/src/types/index.ts` | `LocalSkillInventoryRow` 增 `description?: string | null` |
| `desktop-client/src/components/local-skills-view.tsx` | 列表卡片显示 name + description；移除本地路径行与 `update-item__meta` 元信息行；详情面板 facts 增加 description |
| `desktop-client/src/i18n/messages/{zh-CN,en-US}.ts` | `localSkillsView` 增 `noDescription`、`descriptionLabel` |
| `desktop-client/src/i18n/messages/types.ts` | 同步新增字典键 |
| `desktop-client/src/styles.css` | 新增 `.local-skill-item__description` 截断样式 |
| `desktop-client/src/__tests__/local-skill-inventory-service.test.ts` | 新增 description 解析用例 |
| `desktop-client/src/__tests__/app.test.tsx` | 按需更新本地 SKILL 渲染断言/夹具 |

## 实施顺序

1. **数据层**：`types/index.ts` 增字段 → `local-skill-inventory-service.ts` 解析并写入 description。
2. **i18n**：`zh-CN.ts` / `en-US.ts` / `types.ts` 增 `noDescription`、`descriptionLabel`。
3. **视图**：`local-skills-view.tsx` 列表卡片展示 description 并移走元信息；详情面板 facts 增 description。
4. **样式**：`styles.css` 增 `.local-skill-item__description`（多行省略）。
5. **测试**：更新 `local-skill-inventory-service.test.ts` 与 `app.test.tsx`。
6. **验证**：`npm test`、`npm run build`、`npm run typecheck:electron`。

## 关键决策（待确认）

- D1（卡片保留项）：卡片保留 **状态徽章 + 多路径徽章 + 操作按钮**，仅移除路径文本行与元信息行。理由：状态徽章驱动上传/更新工作流，删掉会伤可用性；文本元信息全部移入详情。
  - 备选：若卡片要「绝对只剩 name+description」，可连状态徽章也移除（更激进、可用性更弱）。
- D2（description 解析）：沿用现有行解析器，description 取 Frontmatter 单行值；多行 YAML 描述块只保留首行。不引入 YAML 依赖。
- 不新增启用/停用按钮（用户已明确暂缓）。

## 验证方式

- `cd desktop-client && npm test` 全绿。
- `npm run build`、`npm run typecheck:electron` 无错。
- 手动核对：列表卡片只显示 name+description（+徽章与按钮）；查看详情面板含 description 与全部元信息。

## 记录

- 实施中发现的信息、偏差或新决策在此补充，并保持 spec 与 plan 同步。

## 验证记录（2026-08-28）

- [x] `cd desktop-client && npm test` 全绿：38 个测试文件、234 个用例通过。
- [x] `npm run build` 通过（含 typecheck:electron、vite build、build:electron）。
- [x] `npm run typecheck:electron` 无错。
- [x] 代码层核对：`local-skill-inventory-service.ts` 解析 description、`types/index.ts` 增字段、
  `local-skills-view.tsx` 卡片/详情展示 description、i18n `zh-CN`/`en-US`/`types.ts` 增
  `noDescription`/`descriptionLabel`、`styles.css` 增 `.local-skill-item__description`、
  相关测试已更新。
- [x] 计划已归档至 `docs/exec-plans/completed/`。