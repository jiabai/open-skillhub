# Exec Plan: Help Center

## Goal

按照 `docs/product-specs/2026-05-19-help-center.md` 实现 SkillDrive Web 控制台的帮助中心。

## Files to Change

| # | 文件路径 | 说明 |
|---|----------|------|
| 1 | `frontend/src/i18n/messages/types.ts` | 扩展 `AppDictionary` 类型，新增 `help` 命名空间 |
| 2 | `frontend/src/i18n/messages/zh-CN.ts` | 添加中文帮助文案 |
| 3 | `frontend/src/i18n/messages/en-US.ts` | 添加英文帮助文案 |
| 4 | `frontend/src/lib/navigation.ts` | 可选：若导航配置需要能力开关则调整 |
| 5 | `frontend/src/components/app/app-shell.tsx` | 在顶部导航右侧新增帮助入口图标 |
| 6 | `frontend/src/app/help/page.tsx` | 帮助中心主页面（服务端组件） |
| 7 | `frontend/src/components/app/help-sidebar.tsx` | 左侧目录树组件 |
| 8 | `frontend/src/components/app/help-content.tsx` | 右侧内容渲染组件 |
| 9 | `frontend/src/components/app/help-layout.tsx` | 帮助页面布局壳（侧边栏+内容） |
| 10 | `frontend/src/lib/help-data.ts` | 帮助目录结构与锚点映射数据 |

## Work Order

### Phase 1: 基础结构与类型（独立可验证）

1. 更新 `types.ts`，定义 `help` 字典类型
2. 在 `zh-CN.ts` 和 `en-US.ts` 中填充帮助文案
3. 创建 `frontend/src/lib/help-data.ts`，定义目录树数据结构
4. 运行 `cd frontend && npm run lint` 验证类型无错误

### Phase 2: 页面与布局（依赖 Phase 1）

5. 创建 `help-sidebar.tsx`：目录树渲染 + 当前激活项追踪
6. 创建 `help-content.tsx`：根据目录数据渲染内容区 + 锚点 ID
7. 创建 `help-layout.tsx`：组合侧边栏与内容，处理响应式（桌面左右分栏 / 移动端抽屉）
8. 创建 `app/help/page.tsx`：使用 HelpLayout 并传入字典数据

### Phase 3: 导航集成（依赖 Phase 2）

9. 修改 `app-shell.tsx`：在 ThemeToggle 旁新增 `HelpCircle` 图标按钮，链接到 `/help`
10. 确保 `/help` 在未登录态下不被重定向到登录页（`isPublicRoute` 已包含 `/`，需扩展为包含 `/help`）

### Phase 4: 验证

11. 运行 `cd frontend && npm run lint`
12. 运行 `cd frontend && npm run build`
13. 检查暗黑模式下目录高亮与内容可读性
14. 检查移动端目录抽屉交互

## Decisions to Track

| 决策 | 记录 |
|------|------|
| 内容渲染方式 | 使用 TSX 组件 + i18n 字典，而非 MDX。原因：项目无 MDX 依赖，且现有所有用户文案均走 i18n，保持一致性 |
| 路由公开性 | `/help` 设为公开路由，未登录用户可访问，降低了解门槛 |
| 搜索功能 | 第一期不实现，降低复杂度；后续若内容膨胀再考虑 |
| 目录数据来源 | 集中放在 `lib/help-data.ts`，与 i18n key 一一对应，便于维护 |

## Validation

- `npm run lint` 通过
- `npm run build` 通过
- 手动验证：切换语言后帮助文案同步切换
- 手动验证：移动端目录抽屉可正常打开/关闭
- 手动验证：目录点击后页面平滑滚动到对应锚点
