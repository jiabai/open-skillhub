# Delete Confirmation Dialog — 设计文档

## 这份文档解决什么问题

Local Skills 视图的删除操作直接触发 `fs.rm` 永久删除，没有任何确认步骤。当聚合行代表多个路径下的副本时，一次删除操作会同时清除所有路径下的 SKILL 文件，存在误操作风险。

## 设计原则

1. **Destructive actions require explicit confirmation**：用户必须显式输入 SKILL 名称才能启用删除按钮。
2. **Show what will be deleted**：对话框展示完整路径和 Agent 归属，让用户明确知道哪些文件将被删除。
3. **Consistent with existing patterns**：复用现有 `Dialog` 组件，遵循 `projects-view.tsx` 的确认对话框模式。
4. **No change to delete logic**：对话框仅作为前置确认，不改变已有的删除实现。

## UI 组件

### 复用现有 Dialog 组件

`ui-primitives.tsx` 中的 `Dialog` 组件已支持：
- `open` / `onClose` 控制显隐
- `title` / `description` 展示信息
- `footer` 放置操作按钮
- `children` 放置自定义内容
- Escape 键关闭
- 点击 overlay 关闭

### 对话框布局

```
┌─────────────────────────────────────────────┐
│  Delete skill                                │
│  This will permanently delete 'review-skill' │
│  from 2 locations.                           │
│  ┌─────────────────────────────────────┐    │
│  │ ⚠️ This action cannot be undone.      │    │
│  │ The following files will be removed:  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Paths to be deleted:                        │
│  • C:\Users\...\.agents\skills\review-skill  │
│    Used by: Codex                            │
│  • C:\Users\...\.claude\skills\review-skill  │
│    Used by: Claude Code                       │
│                                              │
│  Type the skill name to confirm deletion:     │
│  ┌─────────────────────────────────────┐    │
│  │ [_____________________________]     │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  [ Cancel ]  [ Delete ]  ← disabled until   │
│                              name matches    │
└─────────────────────────────────────────────┘
```

## 状态管理

在 `local-skills-view.tsx` 中新增两个 state：

```typescript
const [pendingDeleteGroup, setPendingDeleteGroup] = useState<LocalSkillGroupRow | null>(null)
const [confirmText, setConfirmText] = useState<string>("")
```

- `pendingDeleteGroup`：存储待删除的分组行，`null` 表示对话框关闭
- `confirmText`：存储用户在输入框中键入的文本

## 操作流程

### 触发对话框

```
用户点击删除按钮
  → handleGroupDelete()
    → setPendingDeleteGroup(group)  // 记录目标分组
    → setConfirmText("")            // 清空输入
  → Dialog 渲染
```

### 确认删除

```
用户输入 SKILL 名称
  → confirmText === group.name
  → Delete 按钮启用
用户点击 Delete
  → handleConfirmDelete()
    → onDelete(group.primary, group.items.map(r => r.rowKey))
    → setPendingDeleteGroup(null)
    → setConfirmText("")
```

### 取消删除

```
用户点击 Cancel / overlay / Escape
  → handleCancelDelete()
    → setPendingDeleteGroup(null)
    → setConfirmText("")
```

## i18n 键

在 `localSkillsView` 区块新增以下键：

| 键 | 类型 | 示例 (en) |
|---|---|---|
| `deleteConfirmTitle` | `string` | `"Delete skill"` |
| `deleteConfirmDescription` | `(name: string, count: number) => string` | `"This will permanently delete '{name}' from {count} location(s)."` |
| `deleteConfirmWarning` | `string` | `"This action cannot be undone. The following files will be permanently removed from disk:"` |
| `deleteConfirmPathsTitle` | `string` | `"Paths to be deleted:"` |
| `deleteConfirmPathAgent` | `(agents: string) => string` | `"Used by: {agents}"` |
| `deleteConfirmDestructiveHint` | `string` | `"Type the skill name to confirm deletion:"` |
| `deleteConfirmDestructivePlaceholder` | `string` | `"Type skill name here"` |
| `deleteConfirmButton` | `string` | `"Delete"` |

## 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/i18n/messages/types.ts` | 新增键 | 8 个新 i18n 键 |
| `src/i18n/messages/en-US.ts` | 新增翻译 | 8 个英文翻译 |
| `src/i18n/messages/zh-CN.ts` | 新增翻译 | 8 个中文翻译 |
| `src/components/local-skills-view.tsx` | 修改 | 新增 state、Dialog 渲染、destructive confirm 逻辑 |
| `src/__tests__/app.test.tsx` | 修改 | 适配新的两步删除流程，新增测试用例 |

## 不变更的部分

- `LocalSkillInventoryRow` / `LocalSkillGroupRow` 类型定义
- `handleDeleteLocalSkill` 的实际删除逻辑
- `electron/main.ts` 中的 `deleteLocalSkillByRowKey`
- 后端 API 和数据模型
- `LocalSkillsView` 的聚合/分组逻辑
