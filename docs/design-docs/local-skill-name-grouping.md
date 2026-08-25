# 本地 SKILL 同名聚合 — 设计文档

## 这份文档解决什么问题

桌面客户端 Local Skills 视图以 `packageRootPath` 为粒度展示 SKILL。当用户在多个路径下安装了同名 SKILL（如全局 `~/.agents/skills/` 和项目级 `project/.agents/skills/` 同时存在 `review-skill`），列表会出现重复行。

后端 `skills` 表以 `user_id + name` 为唯一约束，服务端不允许同一用户拥有两个同名 SKILL。客户端 UI 应与此语义对齐：同名 SKILL 聚合为一行。

## 设计原则

1. **聚合不合并数据**：分组仅在展示层进行，底层数据结构保持不变。
2. **操作粒度明确**：上传作用于 primary（组内最新版本的副本），删除作用于全部副本。
3. **版本冲突可见**：同 name 不同 version 的 SKILL 不合并为一组，以警告提示。
4. **向后兼容**：不破坏现有 API 和 IPC 合约。

## 数据结构设计

### 新增类型

```typescript
// desktop-client/src/types/index.ts

export interface LocalSkillGroupRow {
  groupKey: string              // 分组唯一标识，= name
  name: string                   // SKILL 名称
  items: LocalSkillInventoryRow[] // 组内所有行
  primary: LocalSkillInventoryRow // 主显示行
  sourceDisplayNames: string[]    // 去重后的来源代理名称
  pathCount: number               // 组内路径数量
  uploadable: boolean             // 是否有可上传的副本
  hasVersionConflict: boolean     // 是否存在版本冲突
}
```

### 扩展类型

```typescript
// LocalSkillsInventorySnapshot 新增字段
groupedRows: LocalSkillGroupRow[]

// LocalSkillDeletePayload 新增字段
groupRowKeys?: string[]  // 组内所有 rowKey，用于批量删除
```

## 分组算法

### `groupSkillRowsByName`

```
输入: LocalSkillInventoryRow[]
输出: LocalSkillGroupRow[]

步骤:
1. 按 name 分组（无 name 时退化为 rowKey）
2. 对每组检测版本一致性：
   - 若所有 items 的 localVersion 一致 → hasVersionConflict = false
   - 若存在不同 localVersion → hasVersionConflict = true
3. 选择 primary：先按 semver 降序排列，再优先级选择（详见 `pickPrimaryRow`）
4. 构造 LocalSkillGroupRow 返回
```

### `pickPrimaryRow`

```
先按 semver 版本降序排列（最高版本排最前），再按以下优先级选择：
1. 版本排序后，remoteSkillId 非空且 validationState === "valid" 的行
2. 版本排序后，validationState === "valid" 的行
3. 版本排序后，第一行（即最高版本）
```

## UI 渲染

### 视图层改造

`LocalSkillsView` 从渲染 `rows` 改为渲染 `groupedRows`：

- **名称行**：SKILL 名称 + 路径标签
- **操作行**：服务端状态徽章 + 路径数量徽章 + 上传/删除按钮
- **元信息行**：来源代理、本地版本、远端版本、远端 ID、版本冲突警告

### 向后兼容策略

当 `snapshot.groupedRows` 为空时，视图从 `snapshot.rows` 自动生成单条目分组：

```typescript
const groupedRows = snapshot.groupedRows?.length
  ? snapshot.groupedRows
  : snapshot.rows.map(row => ({
      groupKey: row.rowKey,
      name: displayName(row),
      items: [row],
      primary: row,
      sourceDisplayNames: [...row.sourceDisplayNames],
      pathCount: 1,
      uploadable: row.uploadable,
      hasVersionConflict: false,
    }))
```

## 操作流程

### 上传

保持原有单 `rowKey` 上传流程不变。视图层使用 `group.primary`（即版本最高的副本）作为上传目标。

```
用户点击上传 → handleGroupUpload → onUpload(group.primary)
```

### 删除（新增批量能力）

```
用户点击删除 → handleGroupDelete
  → onDelete(group.primary, group.items.map(r => r.rowKey))
    → desktopClient.deleteLocalSkill({ rowKey, groupRowKeys })
      → main.ts 遍历 groupRowKeys 删除所有路径
```

## 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/types/index.ts` | 新增类型 | `LocalSkillGroupRow`，扩展 `LocalSkillsInventorySnapshot` 和 `LocalSkillDeletePayload` |
| `src/core/local-skills/local-skill-inventory-service.ts` | 新增函数 | `pickPrimaryRow`、`groupSkillRowsByName`，更新 `refresh()` |
| `src/components/local-skills-view.tsx` | 重写 | 从渲染 `rows` 改为渲染 `groupedRows`，新增路径标签和版本冲突警告 |
| `src/app/App.tsx` | 修改 | `handleDeleteLocalSkill` 增加 `groupRowKeys` 参数 |
| `electron/main.ts` | 修改 | `deleteLocalSkillByRowKey` 支持批量删除 |
| `src/i18n/messages/en-US.ts` | 新增键 | `pathCount`、`versionConflict` |
| `src/i18n/messages/zh-CN.ts` | 新增键 | `pathCount`、`versionConflict` |
| `src/i18n/messages/types.ts` | 新增键 | `pathCount`、`versionConflict` |
| `src/__tests__/project-skill-scan-service.test.ts` | 修复测试 | 补齐 `groupedRows` 字段 |

## 不变更的部分

- 后端模型和 API
- `LocalSkillInventoryRow` 类型定义
- `rowKey` 生成规则
- 上传 IPC 合约
- `openLocalSkillFolder` 行为（仍打开 primary 路径）

## 验证要求

- `npm test` 全部通过
- `npm run build` 构建成功
- 手动验证：同名同版本 SKILL 聚合显示
- 手动验证：同名不同版本 SKILL 独立显示并提示冲突