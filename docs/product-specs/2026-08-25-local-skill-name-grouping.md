# 本地 SKILL 同路径名聚合

## 背景

桌面客户端的 Local Skills 视图按 `packageRootPath` 去重展示每一行。当用户在不同目录下拥有同名 SKILL（如同时在 `~/.agents/skills/` 和项目级 `project/.agents/skills/` 中各有一份 `review-skill`），列表会展示多行相同名称的 SKILL，造成信息冗余和操作混乱。

后端 `skills` 表有 `UniqueConstraint("user_id", "name")`，这意味着服务端以 SKILL 名称作为唯一键。客户端也应遵循这一语义：同名 SKILL 在 UI 上应聚合为一行，路径信息作为附加标签展示。

## 目标

1. 同名 SKILL 在 Local Skills 视图中聚合为一行，不再重复显示。
2. 聚合行显示：SKILL 名称、路径标签（显示绝对路径，如 `C:\Users\bicho\.claude\skills\improve-codebase-architecture`）、版本信息、来源代理。
3. 版本冲突检测：同一名称但不同版本的 SKILL 不合并为同一行，以警告形式提示。
4. 上传/删除操作语义清晰：上传作用于组内最新版本的副本（primary），删除作用于全部副本。
5. 保持向后兼容：`groupedRows` 为空时从 `rows` 自动生成单条目分组。

## 非目标

- 不改变后端数据模型或 API。
- 不改变 SKILL 上传/下载的网络协议。
- 不实现跨路径的自动合并或去重（如自动删除重复副本）。
- 不改变 `rowKey` 的生成规则（仍由路径+名称哈希生成）。
- 不改变桌面客户端以外的模块。

## 使用场景

1. 用户在全局 `~/.agents/skills/` 和项目级 `project/.agents/skills/` 下各有一份 `review-skill`，Local Skills 视图只显示一行，路径标签展示两个绝对路径（如 `C:\Users\bicho\.agents\skills\review-skill` 和 `D:\Projects\project\.agents\skills\review-skill`）。
2. 用户同名但不同版本的 SKILL（如一个 v1.0、一个 v1.2），显示为两行独立记录，版本列标注冲突警告。
3. 用户点击删除时，组内所有路径下的副本都被删除。
4. 用户点击上传时，组内版本最高的副本（primary）被上传。

## 约束

- 仅修改 `desktop-client/` 范围内的代码。
- `LocalSkillInventoryRow` 类型保持不变，新增 `LocalSkillGroupRow` 作为聚合层类型。
- `LocalSkillsInventorySnapshot` 新增 `groupedRows` 字段，保留原有 `rows` 字段以保持向后兼容。
- 上传操作的 `rowKey` 行为不变（仍传单个 `rowKey`），删除操作扩展 `payload` 支持 `groupRowKeys`。
- 版本冲突判定以 `localVersion` 字段为准。

## 验收标准

- [ ] 同名同版本 SKILL 在视图中显示为单行，路径以标签形式展示绝对路径。
- [ ] 同名不同版本 SKILL 在视图中显示为多行，每行有版本冲突警告。
- [ ] 删除操作清除组内所有路径下的副本。
- [ ] 上传操作上传组内最新版本的副本（primary）。
- [ ] `npm test` 全部通过。
- [ ] `npm run build` 构建成功。
- [ ] 现有的单路径 SKILL 行为不受影响（向后兼容）。