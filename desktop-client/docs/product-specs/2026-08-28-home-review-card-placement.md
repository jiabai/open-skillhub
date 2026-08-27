# Desktop Home Review Card Placement

> 状态：待审核产品规格

## 用户目标

在 Desktop Client 首页保留当前“需要审核”卡片的右侧栏宽度，但将它移动到指标区域的下方。用户打开 Home 时先看到同步指标，再在页面下方看到待审核预览；卡片属于正常页面内容，随页面滚动，不固定在窗口底部，也不遮挡其他内容。

## 用户问题

宽屏 Home 当前将指标区和“需要审核”卡片并排展示。用户希望审核卡片固定在首页内容的下方，同时保持原有右侧栏的视觉宽度，避免审核预览在首页首屏与指标抢占水平注意力。

## 范围

本次包含：

- 调整 Desktop Home 宽屏布局的 CSS 网格位置。
- 让指标区横跨现有 Home 两列网格。
- 让“需要审核”区域出现在下一行的第 2 列，保留当前右侧栏宽度并右对齐。
- 保留现有最多 3 条预览、状态摘要、空状态、加载状态和“查看全部更新”入口。
- 增加或更新 Renderer 回归测试，锁定 Home 内容顺序和现有交互不回退。

## 非范围

- 不改变 pending update 数据、排序、数量上限或预分发检查逻辑。
- 不改变 Home 到 Updates 的导航行为。
- 不新增 API、IPC、持久化状态或后端字段。
- 不将审核卡片改成 `position: fixed`、`position: sticky` 或视口级底栏。
- 不改变 `1100px` 以下的单列布局，也不改变 `1100px–1439px` 的现有堆叠行为。
- 不修改 Updates、Local Skills、Projects 或 Settings 的布局。

## 设计与响应式行为

### 宽屏：`>= 1440px` CSS 宽度

- Home 继续使用现有两列网格比例和间距。
- 指标区域跨越两列，保持指标卡片的现有内容与顺序。
- “需要审核”区域放到下一行第 2 列，因此宽度继续由当前右侧网格列决定。
- 左下方不新增空白列内容；审核卡片保持在右侧栏位置。

### 中等与窄屏：`< 1440px` CSS 宽度

- 保持当前页面内容顺序和单列堆叠，不引入新的 breakpoint。
- 审核卡片仍位于指标内容之后，并继续使用现有可读性与操作间距。

## 验收标准

1. 在 `>= 1440px` 宽度下，指标区位于 Home 审核预览之前，审核预览位于下一行右侧栏位置。
2. 宽屏审核卡片的宽度仍由现有 Home 右侧网格列决定，而不是通过新的固定像素宽度近似模拟。
3. 审核卡片属于正常文档流，滚动时不吸底、不覆盖指标或其他页面内容。
4. 审核卡片仍显示最多 3 个待审核项目；无数据、加载中和错误状态保持现有行为。
5. “查看全部更新”仍能进入 Updates 页面，Home 不重新获得单项分发或批量分发操作。
6. `1100px–1439px` 与 `< 1100px` 下不出现横向溢出、内容遮挡或关键控件不可访问。
7. Desktop Renderer 测试覆盖宽屏 Home 的结构顺序或对应布局钩子，并且现有 Home、Updates 导航测试继续通过。

## 受影响的文件

- `desktop-client/src/styles.css`：宽屏 Home 网格行列定位。
- `desktop-client/src/__tests__/app.test.tsx`：Home 布局/顺序回归断言（如现有测试结构允许）。
- `desktop-client/docs/product-specs/index.md`：登记本规格。

## 验证要求

实现后至少运行：

```bash
cd desktop-client && npm test -- src/__tests__/app.test.tsx
cd desktop-client && npm test
cd desktop-client && npm run typecheck:electron
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

另外需要在宽屏、中等宽度和窄屏检查 Home 的正常数据、空数据与错误/未配置状态，确认审核卡片不遮挡内容。

## 相关文档

- `2026-08-27-responsive-review-workspace.md`
- `../DESIGN.md`
- `../ARCHITECTURE.md`
- `../../docs/EXECUTION_GATES.md`
