# Runtime Config / Capabilities 执行结果

## 目标

将前端业务能力判断从编译期环境变量迁移到后端拥有的 runtime capabilities contract，并让前端统一消费这份 contract。

## 执行结果

目标已完成。

### 后端已落地

- 新增 `backend/schemas/runtime_config.py`
- 新增 `backend/services/runtime_config.py`
- 新增 `backend/api/v1/runtime_config.py`
- 在 `backend/api/router.py` 注册 `/api/v1/runtime-config`
- 新增 `tests/test_runtime_config_api.py`

### 前端已落地

- 新增 `frontend/src/lib/runtime-config.ts`
- 新增 `frontend/src/components/app/runtime-config-provider.tsx`
- 新增 `frontend/src/hooks/use-runtime-config.ts`
- 在 `frontend/src/app/layout.tsx` 接入 provider
- 页面改为直接消费 runtime capability
- 删除 `frontend/src/lib/feature-flags.ts`
- 删除 `frontend/src/lib/app-mode.ts`

### 配置清理已落地

- `frontend/.env.example` 已删除业务型前端 env
- `frontend/Dockerfile` 已删除对应业务型 build args / env

## 实际迁移顺序

### 1. 建立后端 contract

先完成 runtime-config schema、service、API 和测试，确保 capability 派生逻辑只在后端存在一份。

### 2. 建立前端运行时数据层

新增 runtime-config client、provider、hook，并把默认降级策略统一为“能力关闭”。

### 3. 接入应用壳层

将 provider 接到应用壳层，让页面和组件不再各自推导系统能力。

### 4. 迁移页面与组件

逐步把以下页面迁到 capability-first：

- login / register
- audit
- dashboard
- profile
- skills/new
- skills/[skillUuid]
- skills
- public-skills
- tokens
- app-shell

### 5. 删除兼容壳

在生产代码不再依赖旧入口后，删除：

- `frontend/src/lib/feature-flags.ts`
- `frontend/src/lib/app-mode.ts`

### 6. 清理命名和文案

将 UI 从“mode”表述继续收口到 capability / workspace 语义，例如：

- `mode-boundary-note.tsx` -> `workspace-boundary-note.tsx`
- `RBAC / No-RBAC` -> `Scoped Access / Personal Workspace`

## 验证结果

后端：

- `uv run pytest tests/test_runtime_config_api.py -q`

前端：

- `npm.cmd test -- --run src/__tests__/runtime-config.test.tsx src/__tests__/app-shell-auth.test.tsx src/__tests__/pages.test.tsx`

最近一次前端结果：

- 3 个测试文件通过
- 23 个测试通过

## 当前代码边界

### 保留

- 后端内部原始 `settings`
- runtime-config capability contract
- 前端 `useRuntimeConfig()` 作为系统能力读取入口

### 删除

- 前端业务型 `NEXT_PUBLIC_ENABLE_*`
- `feature-flags.ts`
- `app-mode.ts`

## 后续可选任务

如果还要继续增强，建议按这个顺序：

1. 增加 capability contract 的更多后端测试覆盖
2. 明确前端 permission helper，进一步强化 capability / permission 分层
3. 增加面向文档和部署的 capability 变更说明

## 归档说明

这份文件不再作为待执行计划使用，而是作为本次 runtime-config / capabilities 迁移的执行结果记录。若后续继续扩展 capability 范围，应新开一份增量计划文档，而不是继续复用旧的 checkbox 计划。
