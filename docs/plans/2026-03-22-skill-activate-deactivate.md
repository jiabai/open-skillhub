# Skill 激活/停用功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Skills 列表页和详情页添加激活/停用功能

**Architecture:**
- 列表页：每个 Skill 卡片添加激活/停用切换按钮
- 详情页：Tabs 上方添加独立状态栏，显示当前状态并提供切换按钮
- 使用现有 API：`activateSkill` 和 `deactivateSkill`

**Tech Stack:** Next.js 14 + React + TypeScript + Tailwind CSS + shadcn/ui (Badge, Button, Switch, AlertDialog)

---

## 前置条件

- API 方法已就绪：`activateSkill`, `deactivateSkill`
- Skill 类型已包含 `is_active` 字段
- 现有页面：`frontend/src/app/skills/page.tsx`, `frontend/src/app/skills/[skillUuid]/page.tsx`

---

## Task 1: 更新 Skills 列表页

**Files:**
- Modify: `frontend/src/app/skills/page.tsx`

**Step 1: 添加激活/停用处理函数**

在 `handleDelete` 函数后添加：

```typescript
const handleToggleActive = async (skillUuid: string, currentStatus: boolean) => {
  try {
    if (currentStatus) {
      await api.deactivateSkill(skillUuid)
    } else {
      await api.activateSkill(skillUuid)
    }
    await loadSkills(query)
  } catch (err) {
    setError(err instanceof Error ? err.message : "操作失败")
  }
}
```

**Step 2: 更新 Skill 卡片操作按钮区域**

找到按钮区域（大约第 115-136 行），修改为：

```tsx
<div className="flex items-center gap-2">
  <Button variant="outline" asChild>
    <Link href={`/skills/${skillUuid}`}>查看</Link>
  </Button>
  <Button
    variant={skill.is_active ? "secondary" : "outline"}
    size="sm"
    onClick={() => handleToggleActive(skillUuid, skill.is_active ?? false)}
  >
    {skill.is_active ? "停用" : "启用"}
  </Button>
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="destructive" size="icon" aria-label="删除 Skill">
        <Trash2 className="h-4 w-4" />
      </Button>
    </AlertDialogTrigger>
    ...
  </AlertDialog>
</div>
```

**Step 3: 添加状态 Badge**

在 Badge 区域（第 110-113 行）添加状态显示：

```tsx
<div className="flex flex-wrap gap-2">
  <Badge variant={skill.is_active ? "accent" : "muted"}>
    {skill.is_active ? "已启用" : "已停用"}
  </Badge>
  <Badge variant="muted">私有目录</Badge>
  <Badge variant="outline">id: {skill.id.slice(0, 8)}</Badge>
</div>
```

**Step 4: Commit**

```bash
git add frontend/src/app/skills/page.tsx
git commit -m "feat(frontend): add activate/deactivate toggle to skills list"
```

---

## Task 2: 更新 Skill 详情页

**Files:**
- Modify: `frontend/src/app/skills/[skillUuid]/page.tsx`

**Step 1: 添加状态栏组件**

在页面标题和 Tabs 之间（大约第 121 行前）添加状态栏：

```tsx
{/* 状态栏 */}
{status === "ready" && skill && (
  <Card className={skill.is_active ? "border-accent/50 bg-accent/5" : "border-muted"}>
    <CardContent className="flex items-center justify-between py-4">
      <div className="flex items-center gap-4">
        <div className={`h-3 w-3 rounded-full ${skill.is_active ? "bg-accent" : "bg-muted-foreground"}`} />
        <div>
          <p className="font-medium">
            {skill.is_active ? "已启用" : "已停用"}
          </p>
          <p className="text-sm text-muted-foreground">
            {skill.is_active
              ? "Skill 当前处于活跃状态，可以正常使用"
              : "Skill 当前处于停用状态，不可访问"}
          </p>
        </div>
      </div>
      <Button
        variant={skill.is_active ? "outline" : "default"}
        onClick={async () => {
          try {
            if (skill.is_active) {
              await api.deactivateSkill(skill.id)
            } else {
              await api.activateSkill(skill.id)
            }
            await fetchData()
          } catch (err) {
            setError(err instanceof Error ? err.message : "操作失败")
          }
        }}
      >
        {skill.is_active ? "停用 Skill" : "启用 Skill"}
      </Button>
    </CardContent>
  </Card>
)}
```

**Step 2: 更新导入**

确保导入 `Switch` 组件（如果需要）或只使用 Button。

**Step 3: Commit**

```bash
git add frontend/src/app/skills/\[skillUuid\]/page.tsx
git commit -m "feat(frontend): add status bar with toggle to skill detail page"
```

---

## Task 3: 运行测试验证

**Step 1: TypeScript 检查**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 无错误

**Step 2: 构建验证**

```bash
cd frontend && npm run build
```
Expected: 构建成功

---

## Task 4: 更新文档

**Files:**
- Modify: `docs/frontend-design/04-basics-readonly.md`

**Step 1: 更新 Skills 列表页文档**

在 4.3 节中找到 Skills 列表说明，更新为包含激活/停用功能。

**Step 2: 更新 Skill 详情页文档**

在 4.4 节中找到 Skill 详情说明，添加状态栏描述。

**Step 3: Commit**

```bash
git add docs/frontend-design/04-basics-readonly.md
git commit -m "docs: update documentation with skill activate/deactivate feature"
```

---

## 总结

完成以上 4 个 Task 后，Skill 激活/停用功能将具备：

1. ✅ Skills 列表页显示状态并提供启用/停用按钮
2. ✅ Skill 详情页顶部显示状态栏和切换按钮
3. ✅ 实时刷新列表数据
4. ✅ 符合设计系统规范

