状态：本地规范产品文档，已按评审意见修订

## 目标

为桌面客户端提供用户友好的 API Token 配置界面，允许用户在应用内直接输入和管理认证信息，无需依赖命令行环境变量。

## 产品目标

- 用户可在桌面界面完成完整的 Token 配置流程
- Token 存储在系统级安全凭证存储（keytar）
- API Base URL 存储为非敏感本地配置，不进入 secret store
- 提供清晰的配置状态反馈
- 支持多服务器切换（开发/生产环境）

## 非目标

- 登录界面（用户名/密码登录）
- OAuth 或其他第三方认证流程
- Token 自动生成或服务器端 Token 管理
- 多账户切换

## 目标用户

| 用户类型 | 场景 |
|---------|------|
| 操作员 | 从服务端管理员处获得 API Token，需要配置客户端 |
| 重配置用户 | 需要更换 Token 或切换服务器地址 |
| 环境切换用户 | 在开发/生产服务器之间切换 |

## 用户流程

### 首次启动

```
App 启动 → 检测无 Token → 显示配置面板 → 用户输入 → 保存 → 运行时重载配置 → 可选连接测试 → 进入主界面
```

### 已配置状态

```
App 启动 → 检测已有 Token → 直接进入主界面 → Settings 面板显示状态 → 可点击"编辑配置"
```

### 配置面板交互

```
┌─────────────────────────────────────────────────────────────┐
│                    API Configuration                         │
│                                                             │
│  API Base URL                                               │
│  [http://127.0.0.1:8001                            ] [✓]    │
│                                                             │
│  API Token                                                  │
│  [••••••••••••••••••••••••••                    ] [👁]      │
│                                                             │
│  [Save Configuration]  [Clear Token]                        │
│                                                             │
│  Status: ● Token saved to system credential store           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 状态反馈

| 状态 | 显示 |
|------|------|
| 未配置 | "Configure API Token" 按钮高亮 |
| 已保存 | 绿色状态指示 + "Token saved" |
| 连接失败 | 黄色警告 + 错误信息 |
| 测试成功 | "API token accepted; client API reachable" |
| 环境变量导入 | "Token imported from environment" 来源指示 |

## UI 概述

### 新增组件

| 组件 | 位置 | 功能 |
|------|------|------|
| ConfigPanel | 主界面中央 | Token 输入表单 |
| ConfigStatus | Settings 面板 | 配置状态显示 |

### 修改组件

| 组件 | 修改内容 |
|------|---------|
| SettingsPanel | 添加"Edit Configuration"按钮 |
| NavShell | 支持配置模式渲染 |
| App | 添加配置状态管理 |

## 成功标准

- 用户可在桌面 UI 内完成 Token 配置，无需终端操作
- Token 存储在 Windows Credential Manager / macOS Keychain / Linux Secret Service
- 连接测试通过已认证的 client API 探测提供明确的成功/失败反馈
- Settings 面板正确显示当前配置状态
- Token 值在保存后不再暴露给渲染进程
- 保存或清除配置后，主进程内存中的运行时配置立即刷新，无需重启应用

## 产品规则

### 配置优先级

```
1. 系统安全存储（keytar） ← 最高优先级
2. 环境变量 OPEN_SKILLHUB_API_TOKEN ← 次优先级，首次使用后自动保存
3. 未配置 ← 显示配置面板
```

API Base URL 的优先级：

```
1. 本地 JSON 配置 config/config.json
2. 环境变量 OPEN_SKILLHUB_API_BASE_URL
3. 默认值 http://127.0.0.1:8001
```

### 安全规则

- 渲染进程永远不获取已保存的 Token 实际值
- `getConfiguration()` 只返回 `hasToken: boolean`
- Token 仅在保存操作时传递给主进程
- `getConfiguration()` 可返回脱敏的来源和 secret-store 可用性状态
- URL 存储在 JSON 配置文件，Token 只存储在 keytar
- 清除 Token 同时清除 URL 配置

### 交互规则

- 连接测试可选，不强制要求成功才能保存
- 连接测试必须调用带 Bearer Token 的 client-oriented API，例如 `GET /api/v1/client/skills?limit=1`
- 不新增专用的 `/api/v1/health` 端点；根路径 `/health` 仅用于运维健康检查
- 离线配置允许（用户可能稍后启动服务器）
- 环境变量来源的 Token 应显示来源指示器
- 保存配置后应立即尝试刷新 review state；失败时显示可操作错误，不回滚已保存配置
