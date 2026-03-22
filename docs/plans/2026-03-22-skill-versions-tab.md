# Skill 详情页版本 Tab 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Skill 详情页添加版本管理 Tab，支持版本列表展示、版本对比和回滚功能

**Architecture:** 在现有 Skill 详情页 Tabs 组件中新增 "版本" Tab，采用左右分栏布局（列表 + 详情），使用复选框选择最多两个版本进行对比，对比结果通过 diff API 获取

**Tech Stack:** Next.js 14 + React + TypeScript + Tailwind CSS + shadcn/ui (Tabs, Card, Badge, Button, Checkbox, Skeleton)

---

## 前置条件

- API 方法已就绪：`listSkillVersions`, `diffSkillVersions`, `rollbackSkillVersion`
- 类型定义已就绪：`SkillVersion`, `SkillVersionDiff`
- 设计系统规范：`docs/design-system.md`

---

## Task 1: 创建 VersionsTab 组件文件结构

**Files:**
- Create: `frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx`

**Step 1: 创建组件文件和基础结构**

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { GitCompare, Loader2, RotateCcw, Package } from "lucide-react"

import { api } from "@/lib/api"
import type { SkillVersion, SkillVersionDiff } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"

type VersionsTabProps = {
  skillUuid: string
}

export function VersionsTab({ skillUuid }: VersionsTabProps) {
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [diffResult, setDiffResult] = useState<SkillVersionDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [rollbackLoading, setRollbackLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载版本列表
  const fetchVersions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listSkillVersions(skillUuid)
      setVersions(response.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载版本列表失败")
    } finally {
      setLoading(false)
    }
  }, [skillUuid])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  // 处理版本选择
  const handleVersionSelect = (version: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version)
      }
      if (prev.length >= 2) {
        return [prev[1], version] // 保留最新的两个
      }
      return [...prev, version]
    })
  }

  // 获取版本对比
  useEffect(() => {
    if (selectedVersions.length === 2) {
      const fetchDiff = async () => {
        setDiffLoading(true)
        try {
          const result = await api.diffSkillVersions(
            skillUuid,
            selectedVersions[0],
            selectedVersions[1]
          )
          setDiffResult(result)
        } catch (err) {
          console.error("Failed to fetch diff:", err)
        } finally {
          setDiffLoading(false)
        }
      }
      fetchDiff()
    } else {
      setDiffResult(null)
    }
  }, [selectedVersions, skillUuid])

  // 回滚到指定版本
  const handleRollback = async (version: string) => {
    setRollbackLoading(true)
    try {
      await api.rollbackSkillVersion(skillUuid, version)
      await fetchVersions() // 刷新列表
      setSelectedVersions([])
    } finally {
      setRollbackLoading(false)
    }
  }

  // 渲染版本列表
  const renderVersionList = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    }

    if (error) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchVersions}>
              重试
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (versions.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Package className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无版本记录</p>
            <p className="text-xs text-muted-foreground mt-1">版本会在部署时自动生成</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-2">
        {versions.map((v) => (
          <Card
            key={v.version}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedVersions.includes(v.version) ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => handleVersionSelect(v.version)}
          >
            <CardContent className="flex items-start gap-3 py-3">
              <Checkbox
                checked={selectedVersions.includes(v.version)}
                onCheckedChange={() => handleVersionSelect(v.version)}
                aria-label={`选择版本 ${v.version}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{v.version}</span>
                  {selectedVersions.length === 2 &&
                    selectedVersions.includes(v.version) && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedVersions[0] === v.version ? "旧" : "新"}
                      </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {v.description || "无描述"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(v.created_at), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // 渲染单个版本详情
  const renderSingleVersion = (version: SkillVersion) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>版本 {version.version}</span>
          <Badge variant="outline">{version.dependencies.length} 个依赖</Badge>
        </CardTitle>
        <CardDescription>
          创建于 {new Date(version.created_at).toLocaleString("zh-CN")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">描述</h4>
          <p className="text-sm text-muted-foreground">
            {version.description || "无描述"}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">依赖</h4>
          {version.dependencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">无依赖</p>
          ) : (
            <ul className="space-y-1">
              {version.dependencies.map((dep) => (
                <li key={dep} className="text-sm text-muted-foreground">
                  • {dep}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">元数据</h4>
          <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto">
            {JSON.stringify(version.metadata, null, 2)}
          </pre>
        </div>
        <Button
          variant="outline"
          onClick={() => handleRollback(version.version)}
          disabled={rollbackLoading}
        >
          {rollbackLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          回滚到此版本
        </Button>
      </CardContent>
    </Card>
  )

  // 渲染版本对比
  const renderDiff = () => {
    if (!diffResult) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            版本对比
          </CardTitle>
          <CardDescription>
            {diffResult.from_version} → {diffResult.to_version}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {diffLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {(diffResult.added.length > 0 || diffResult.removed.length > 0) && (
                <div>
                  <h4 className="text-sm font-medium mb-2">依赖变更</h4>
                  {diffResult.added.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">新增:</p>
                      <ul className="space-y-1">
                        {diffResult.added.map((dep) => (
                          <li key={dep} className="text-sm text-green-600">
                            + {dep}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {diffResult.removed.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">移除:</p>
                      <ul className="space-y-1">
                        {diffResult.removed.map((dep) => (
                          <li key={dep} className="text-sm text-red-600">
                            - {dep}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {diffResult.modified.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">文件变更</h4>
                  <div className="space-y-2">
                    {diffResult.modified.map((mod) => (
                      <div key={mod.path} className="text-sm">
                        <p className="font-medium">{mod.path}</p>
                        <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1 overflow-auto">
                          {mod.diff}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => handleRollback(diffResult.from_version)}
                disabled={rollbackLoading}
              >
                {rollbackLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                回滚到 {diffResult.from_version}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // 渲染右侧面板
  const renderRightPanel = () => {
    if (selectedVersions.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GitCompare className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">选择版本查看详情或对比</p>
            <p className="text-xs text-muted-foreground mt-1">
              选择单个版本查看详情，选择两个版本进行对比
            </p>
          </CardContent>
        </Card>
      )
    }

    if (selectedVersions.length === 1) {
      const version = versions.find((v) => v.version === selectedVersions[0])
      if (!version) return null
      return renderSingleVersion(version)
    }

    return renderDiff()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">版本列表</h3>
        {renderVersionList()}
      </div>
      <div>{renderRightPanel()}</div>
    </div>
  )
}
```

**Step 2: 创建目录（如果不存在）**

```bash
mkdir -p frontend/src/app/skills/\[skillUuid\]/_components
```

**Step 3: Commit**

```bash
git add frontend/src/app/skills/\[skillUuid\]/_components/versions-tab.tsx
git commit -m "feat(frontend): create VersionsTab component"
```

---

## Task 2: 更新 Skill 详情页集成 VersionsTab

**Files:**
- Modify: `frontend/src/app/skills/[skillUuid]/page.tsx`

**Step 1: 添加导入**

在文件顶部添加：

```tsx
import { VersionsTab } from "./_components/versions-tab"
```

**Step 2: 添加版本 Tab**

在 TabsList 中添加版本 Tab：

```tsx
<TabsList>
  <TabsTrigger value="overview">概览</TabsTrigger>
  <TabsTrigger value="files">文件</TabsTrigger>
  <TabsTrigger value="versions">版本</TabsTrigger>  {/* 新增 */}
  <TabsTrigger value="settings">设置</TabsTrigger>
</TabsList>
```

**Step 3: 添加版本 TabContent**

在 Tabs 组件内添加：

```tsx
<TabsContent value="versions">
  <VersionsTab skillUuid={params.skillUuid} />
</TabsContent>
```

**Step 4: 验证 TypeScript 编译**

Run: `cd frontend && npx tsc --noEmit`
Expected: 无错误

**Step 5: Commit**

```bash
git add frontend/src/app/skills/\[skillUuid\]/page.tsx
git commit -m "feat(frontend): integrate VersionsTab into Skill detail page"
```

---

## Task 3: 添加 date-fns 依赖（如未安装）

**Step 1: 检查是否已安装**

```bash
cd frontend && npm list date-fns
```

**Step 2: 如未安装，添加依赖**

```bash
cd frontend && npm install date-fns
```

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): add date-fns for date formatting"
```

---

## Task 4: 运行测试验证

**Step 1: 运行 TypeScript 检查**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 无错误

**Step 2: 运行单元测试**

```bash
cd frontend && npm test -- --run
```
Expected: 所有测试通过

**Step 3: 构建验证**

```bash
cd frontend && npm run build
```
Expected: 构建成功，页面数增加

**Step 4: Commit（如无需修改）**

如果测试通过且无需修改代码，无需额外 commit。

---

## Task 5: 文档更新

**Files:**
- Modify: `docs/frontend-design/03-pages.md`（如存在）或 `docs/design-system.md`

**Step 1: 更新 Skill 详情页文档**

在文档中添加版本 Tab 的说明：

```markdown
### Skill 详情页 - 版本 Tab

**功能：**
- 展示版本历史列表
- 支持选择两个版本进行对比
- 显示依赖变更（新增/移除）
- 支持回滚到指定版本

**组件：**
- `VersionsTab` - 主容器组件
- 布局：左侧版本列表 + 右侧详情面板

**交互：**
- 单选：查看版本详情
- 双选：对比版本差异
- 回滚：创建新版本（复制目标版本）
```

**Step 2: Commit**

```bash
git add docs/
git commit -m "docs: update Skill detail page documentation with versions tab"
```

---

## Task 6: 更新 Memory 记录

**Files:**
- Modify: `~/memory/projects/INDEX.md`

**Step 1: 更新待办事项**

将 "Skill 详情页 Tabs" 标记为已完成，记录新功能。

**Step 2: Commit**

```bash
# 在 memory 目录执行
git add INDEX.md
git commit -m "docs(memory): update project progress"
```

---

## 总结

完成以上 6 个 Task 后，Skill 详情页将具备完整的版本管理功能：

1. ✅ 版本列表展示（版本号、描述、创建时间）
2. ✅ 单版本详情查看（描述、依赖、元数据）
3. ✅ 双版本对比（依赖变更、文件差异）
4. ✅ 版本回滚功能
5. ✅ 符合设计系统规范
6. ✅ TypeScript 类型安全
7. ✅ 加载状态和错误处理

**下一步：** 审计日志页面（可选，中优先级）
