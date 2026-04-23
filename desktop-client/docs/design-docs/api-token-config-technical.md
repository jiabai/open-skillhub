# API Token Configuration - Technical Design

## IPC 扩展

### 新增 Channel

```typescript
// electron/ipc.ts
export const desktopClientIpcChannels = {
  refreshSync: "sync:refresh",
  distributePendingUpdate: "distribution:run",
  // NEW:
  getConfiguration: "desktop-client:get-configuration",
  saveConfiguration: "desktop-client:save-configuration",
  clearConfiguration: "desktop-client:clear-configuration",
  testConnection: "desktop-client:test-connection"
}
```

### IPC 类型定义

```typescript
// Types for IPC bridge
interface ConfigurationPayload {
  apiBaseUrl: string
  apiToken: string
}

interface ConfigurationState {
  apiBaseUrl: string
  hasToken: boolean  // true/false，永远不暴露实际 Token
  tokenSource: 'secret-store' | 'environment' | 'missing'
  persistedEnvironmentToken: boolean
  secretStoreAvailable: boolean
  warning: string | null
}

interface ConnectionTestResult {
  success: boolean
  error?: string
  authenticated?: boolean
  endpoint?: string
}
```

## 主进程实现

### Handler 实现

```typescript
// electron/main.ts

async function handleGetConfiguration(): Promise<ConfigurationState> {
  const state = runtimeConfigManager.getState()

  return {
    apiBaseUrl: state.config.apiBaseUrl,
    hasToken: state.config.apiToken !== null,
    tokenSource: state.bootstrap.source,
    persistedEnvironmentToken: state.bootstrap.persistedEnvironmentToken,
    secretStoreAvailable: state.bootstrap.secretStoreAvailable,
    warning: state.bootstrap.warning
  }
}

async function handleSaveConfiguration(payload: ConfigurationPayload): Promise<void> {
  const normalizedUrl = normalizeBaseUrl(payload.apiBaseUrl)
  const normalizedToken = payload.apiToken.trim()
  
  if (!normalizedToken) {
    throw new Error("API token cannot be empty")
  }

  validateApiBaseUrl(normalizedUrl)

  await runtimeConfigManager.saveConfiguration({
    apiBaseUrl: normalizedUrl,
    apiToken: normalizedToken
  })
  await restartPollingWithCurrentConfig()
}

async function handleClearConfiguration(): Promise<void> {
  await runtimeConfigManager.clearConfiguration()
  stopPolling?.()
  tray?.setToolTip("SkillHub Desktop - configure API token")
}

async function handleTestConnection(config: ConfigurationPayload): Promise<ConnectionTestResult> {
  const apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl)
  const apiToken = config.apiToken.trim()
  const endpoint = `${apiBaseUrl}/api/v1/client/skills?limit=1`

  try {
    validateApiBaseUrl(apiBaseUrl)

    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiToken}` }
    })
    
    if (!response.ok) {
      return {
        success: false,
        authenticated: response.status !== 401 && response.status !== 403,
        endpoint,
        error: `Client API probe returned ${response.status} ${response.statusText}`
      }
    }
    
    return { success: true, authenticated: true, endpoint }
  } catch (error) {
    return { success: false, authenticated: false, endpoint, error: getErrorMessage(error) }
  }
}
```

This probe is intentionally not a new `/api/v1/health` endpoint. The backend
already exposes root `/health` for operational readiness, but that route does
not validate the desktop bearer token.

### RuntimeConfigManager

`electron/main.ts` currently creates one `runtimeConfig` during startup and passes
that object into sync and package-service closures. The configuration UI must not
only persist new values; it must also make the running process use them.

Introduce a small runtime configuration manager owned by the main process:

```typescript
interface RuntimeConfigurationState {
  config: DesktopRuntimeConfig
  bootstrap: ApiTokenBootstrapResult
}

interface RuntimeConfigManager {
  getState(): RuntimeConfigurationState
  reload(): Promise<RuntimeConfigurationState>
  saveConfiguration(payload: ConfigurationPayload): Promise<RuntimeConfigurationState>
  clearConfiguration(): Promise<RuntimeConfigurationState>
}
```

Implementation rules:

- `reload()` reads URL config from `config/config.json`, resolves token state with
  `resolveApiTokenBootstrap()`, and updates the in-memory state.
- `saveConfiguration()` writes the normalized URL through `createJsonConfigStore()`,
  writes the token through `createKeytarSecretStore(APP_NAME)`, then calls
  `reload()`.
- `clearConfiguration()` clears the keytar token and resets the JSON config to
  defaults, then calls `reload()`.
- Sync and download paths must read the latest config from the manager at call
  time, or the services must be rebuilt after save/clear.
- After a successful save, polling should restart with the current config and the
  UI should refresh review state. If refresh fails, keep the saved configuration
  and surface the network/auth error.

### 是否新增 `/api/v1/health`

**决策**：不新增专用 `/api/v1/health` 端点。连接测试复用现有的
`GET /api/v1/client/skills?limit=1`，根路径 `/health` 仅作为运维健康检查。

## Preload 桥接扩展

```typescript
// electron/preload.ts

const desktopClientBridge: DesktopClientBridge = {
  // existing
  refreshSync: () => ipcRenderer.invoke(desktopClientIpcChannels.refreshSync),
  distributePendingUpdate: (id) => 
    ipcRenderer.invoke(desktopClientIpcChannels.distributePendingUpdate, id),
  // NEW
  getConfiguration: () => 
    ipcRenderer.invoke(desktopClientIpcChannels.getConfiguration),
  saveConfiguration: (payload) => 
    ipcRenderer.invoke(desktopClientIpcChannels.saveConfiguration, payload),
  clearConfiguration: () => 
    ipcRenderer.invoke(desktopClientIpcChannels.clearConfiguration),
  testConnection: (payload) => 
    ipcRenderer.invoke(desktopClientIpcChannels.testConnection, payload)
}
```

## 渲染进程 IPC Client

```typescript
// src/lib/ipc-client.ts

export interface ConfigurationPayload {
  apiBaseUrl: string
  apiToken: string
}

export interface ConfigurationState {
  apiBaseUrl: string
  hasToken: boolean
  tokenSource: 'secret-store' | 'environment' | 'missing'
  persistedEnvironmentToken: boolean
  secretStoreAvailable: boolean
  warning: string | null
}

export interface ConnectionTestResult {
  success: boolean
  error?: string
  authenticated?: boolean
  endpoint?: string
}

export const desktopClient = {
  // existing
  isAvailable: isDesktopClientAvailable,
  refreshSync: invokeRefreshSync,
  distributePendingUpdate: invokeDistributePendingUpdate,
  // NEW
  getConfiguration: () => bridge!.getConfiguration(),
  saveConfiguration: (payload: ConfigurationPayload) => 
    bridge!.saveConfiguration(payload),
  clearConfiguration: () => bridge!.clearConfiguration(),
  testConnection: (payload: ConfigurationPayload) => 
    bridge!.testConnection(payload)
}
```

## 状态管理

### App.tsx 状态扩展

```typescript
type AppState = {
  // existing
  syncState: DesktopSyncState
  activity: ActivityEntry[]
  isLoading: boolean
  // NEW
  configState: ConfigurationState | null
  configMode: 'reviewing' | 'configuring' | 'saving' | 'testing'
  configError: string | null
}
```

### 状态流转

```
App Mount
    │
    ▼
desktopClient.getConfiguration()
    │
    ▼
hasToken?
    │
    ├── Yes → configMode = 'reviewing', 进入同步流程
    │
    └── No → configMode = 'configuring', 显示 ConfigPanel
```

保存流程：

```
用户保存配置
    │
    ▼
desktopClient.saveConfiguration(payload)
    │
    ▼
主进程写入 keytar + JSON config → runtime config reload → polling restart
    │
    ▼
renderer 调用 refreshSync()，成功则进入 reviewing，失败则显示可操作错误
```

## 安全设计

遵循 `core-beliefs.md` 原则：

### Principle 2: 权限保留在主进程

- Token 存储（keytar）仅在主进程可访问
- 渲染进程在保存后永远不看到 Token 实际值
- `getConfiguration()` 返回 `hasToken: boolean`，不返回 Token
- Token 仅在保存操作时传递给主进程

### Principle 4: 缺约即停

| 异常场景 | 处理 |
|---------|------|
| Token 格式无效 | 保存前拒绝，显示清晰错误 |
| Token 为空 | 拒绝并提示 |
| 连接测试失败 | 显示错误，但不阻止保存 |
| URL 格式错误 | 验证后再保存 |
| 保存后刷新失败 | 保留配置，显示 auth/network 分类错误 |

### Token 可见性

| 时机 | 可见性 |
|------|--------|
| 输入时 | 默认掩码 `••••••`，可切换显示 |
| 保存后 | 永不返回到渲染进程 |
| 状态查询 | 只返回 `hasToken: boolean` |

## URL 存储方案

Token 使用 keytar 存储。URL 为非敏感配置，使用现有 JSON config store
持久化到 `config/config.json`。

| 方案 | 优点 | 缺点 |
|------|------|------|
| State DB (SQLite) | 已存在 | 与同步快照职责混杂，需要扩展 schema |
| 配置文件 (JSON) | 已有 `createJsonConfigStore()`，符合非敏感配置职责 | 文件明文，但 URL 不是 secret |
| keytar | 安全存储 | 设计用于密码，非 URL |

**推荐**：使用 JSON config store 存储 URL。Token 保持 keytar 存储。
State DB 继续只存同步快照、pending updates 和 sync metadata。

## 文件结构

### 新增文件

```
src/
  core/
    runtime/
      runtime-config-manager.ts # 运行时配置读取、保存、重载
  components/
    config-panel.tsx      # 配置表单组件
    config-status.tsx     # 状态指示组件
  lib/
    ipc-client.ts         # 扩展 IPC 方法（修改）
electron/
  ipc.ts                  # 扩展 channels（修改）
  main.ts                 # 扩展 handlers（修改）
  preload.ts              # 扩展 bridge（修改）
```

### 修改文件

| 文件 | 修改类型 |
|------|---------|
| `src/app/App.tsx` | 添加配置状态管理 |
| `src/components/settings-panel.tsx` | 添加编辑按钮 |
| `src/components/nav-shell.tsx` | 支持配置模式渲染 |
