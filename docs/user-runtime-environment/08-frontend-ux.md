---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 前端交互体验设计

### 1. 依赖列表预览

用户上传 Skill ZIP 后，在安装依赖前先展示解析出的依赖列表，让用户确认后再继续。

> **注意**：此处的依赖确认（`confirm-dependencies`）与安全审查确认（`resolve-security`，见核心流程）是两个独立的确认步骤。
> - **安全审查确认**：针对脚本扫描发现的风险操作，用户确认是否继续上传
> - **依赖确认**：针对解析出的依赖列表，用户确认是否安装

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill 上传 - 依赖预览                          │
└─────────────────────────────────────────────────────────────────────┘

ZIP 文件解析完成，检测到以下依赖声明：

┌─────────────────────────────────────────────────────────────────────┐
│  将安装的依赖                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✓ requests        2.31.0        HTTP 请求库                        │
│  ✓ playwright      1.40.0        浏览器自动化                        │
│  ✓ pydantic        2.5.0         数据验证                            │
│                                                                      │
│  新依赖数量: 3                                                       │
│  预估安装时间: 约 30-60 秒                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  已安装的依赖（无需安装）                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  • numpy           1.24.0        已安装                              │
│  • pandas          2.0.0         已安装                              │
│                                                                      │
│  已有依赖数量: 2                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

[确认并安装依赖]  [取消上传]

提示：安装完成后 Skill 即可使用，依赖将保存在您的运行时环境中。
```

#### API 支持

上传接口返回依赖预览信息：

```json
// POST /api/v1/skills/upload 返回（第一阶段：解析完成）
{
  "status": "dependency_preview",
  "skill_uuid": "xxx-xxx-xxx",
  "skill_name": "my-skill",
  "pending_version": "1.0.0",
  "dependencies": {
    "to_install": [
      {"name": "requests", "version": "2.31.0", "reason": "new_dependency"},
      {"name": "playwright", "version": "1.40.0", "reason": "new_dependency"}
    ],
    "already_installed": [
      {"name": "numpy", "version": "1.24.0"},
      {"name": "pandas", "version": "2.0.0"}
    ],
    "estimated_duration_seconds": 45
  },
  "require_confirmation": true
}
```

**新增接口**：`POST /api/v1/skills/upload/confirm-dependencies`

> **接口说明**：此接口用于**确认依赖预览**。当系统解析出 Skill 的依赖列表后（无冲突时），展示给用户预览，用户确认后调用此接口开始安装。
>
> 与 `/resolve-conflict` 的区别：
> - `/confirm-dependencies`：确认依赖预览（无冲突时），决定是否安装
> - `/resolve-conflict`：解决版本冲突（有冲突时），决定是否允许升级

用户确认依赖后继续安装：

```json
// Request
{
  "skill_uuid": "xxx-xxx-xxx",
  "action": "proceed"  // 或 "cancel"
}

// Response (action=proceed)
{
  "status": "installing",
  "message": "Dependency installation started",
  "skill_uuid": "xxx-xxx-xxx"
}

// Response (action=cancel)
{
  "status": "cancelled",
  "message": "Upload cancelled by user"
}
```

**新增接口**：`POST /api/v1/skills/upload/resolve-conflict`

> **接口说明**：此接口用于**解决依赖版本冲突**。当上传的新 Skill 依赖与环境中已安装的依赖版本不兼容时，调用此接口确认是否允许升级/替换依赖。
>
> **超时机制**：冲突等待超时时间为 5 分钟，超时后系统自动取消上传并解锁。

```json
// Request
{
  "skill_uuid": "xxx-xxx-xxx",
  "version": "1.2.0",
  "action": "proceed"  // 或 "cancel"
}

// Response (action=proceed)
{
  "status": "success",
  "version": "1.2.0",
  "installed": ["requests==2.31.0", "new-package==1.0.0"],
  "uninstalled": ["requests==2.28.0"]
}

// Response (action=cancel)
{
  "status": "cancelled",
  "message": "Upload cancelled by user"
}
```

**新增接口**：`POST /api/v1/skills/upload/resolve-security`

> **接口说明**：此接口用于**解决安全审查确认**。当脚本扫描检测到 MEDIUM 级别风险时，调用此接口确认是否继续上传。
>
> **超时机制**：安全审查等待超时时间为 5 分钟，超时后系统自动取消上传并解锁。

```json
// Request
{
  "skill_uuid": "xxx-xxx-xxx",
  "action": "proceed"  // 或 "cancel"
}

// Response (action=proceed)
{
  "status": "success",
  "message": "Security review passed, continuing upload",
  "acknowledged_risks": [
    {
      "pattern": "requests.get",
      "description": "HTTP 网络请求"
    }
  ]
}

// Response (action=cancel)
{
  "status": "cancelled",
  "message": "Upload cancelled due to security concerns"
}
```

### 2. 安装进度反馈

依赖安装过程中，前端显示实时进度，避免用户等待时焦虑。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        正在安装依赖...                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ⏳ 安装进度                                                         │
│                                                                      │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  35%        │
│                                                                      │
│  正在安装: playwright-1.40.0                                         │
│  已完成: requests, pydantic                                          │
│                                                                      │
│  已安装: 2/3                                                         │
│  用时: 25 秒                                                         │
│  预估剩余: 20 秒                                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

[取消安装]

提示：取消安装将回滚所有更改，Skill 不会被上传。
```

#### 进度更新机制

**方案 A：WebSocket 实时推送**

```javascript
// 前端 WebSocket 连接
const ws = new WebSocket('/api/v1/skills/upload/xxx-xxx-xxx/progress');

ws.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  // 更新进度显示
  updateProgressBar(progress);
};

// 服务端推送格式
{
  "type": "install_progress",
  "skill_uuid": "xxx-xxx-xxx",
  "current_package": "playwright",
  "current_version": "1.40.0",
  "completed_packages": ["requests", "pydantic"],
  "total_packages": 3,
  "progress_percent": 35,
  "elapsed_seconds": 25,
  "estimated_remaining_seconds": 20
}
```

**方案 B：轮询进度接口**

```json
// GET /api/v1/skills/upload/{skill_uuid}/progress
{
  "status": "installing",
  "current_package": "playwright",
  "current_version": "1.40.0",
  "completed_packages": ["requests", "pydantic"],
  "total_packages": 3,
  "progress_percent": 35,
  "elapsed_seconds": 25,
  "estimated_remaining_seconds": 20
}

// 轮询间隔建议：每 2-3 秒
```

**推荐方案**：内部用户场景，轮询方案足够，实现简单。

### 3. 错误详情展示

安装失败时，展示详细的错误信息，帮助用户理解问题并采取行动。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ❌ 依赖安装失败                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  失败详情                                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  包名: playwright                                                    │
│  版本: 1.40.0                                                        │
│  错误类型: NETWORK_ERROR                                             │
│                                                                      │
│  错误信息:                                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ERROR: Could not fetch package playwright-1.40.0            │    │
│  │ Reason: Network timeout after 30s                           │    │
│  │ Mirror: https://pypi.org/simple                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  安装状态:                                                           │
│  ✓ requests          2.31.0     安装成功                            │
│  ✓ pydantic          2.5.0      安装成功                            │
│  ❌ playwright       1.40.0     安装失败                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  建议操作                                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  • 检查网络连接是否正常                                               │
│  • 稍后重新尝试上传                                                   │
│  • 如持续失败，请联系管理员                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

[重新尝试]  [取消上传]  [查看完整日志]

提示：已成功安装的依赖 (requests, pydantic) 将被回滚卸载。
```

#### 错误类型分类

| 错误类型 | 错误码 | 说明 | 用户建议 |
|----------|--------|------|----------|
| 网络错误 | `NETWORK_ERROR` | 无法连接 PyPI 或下载超时 | 检查网络，稍后重试 |
| 包不存在 | `PACKAGE_NOT_FOUND` | PyPI 上不存在该包或版本 | 检查包名/版本是否正确 |
| 版本冲突 | `VERSION_CONFLICT` | 与其他已安装包版本冲突 | 查看冲突详情，调整依赖 |
| 权限错误 | `PERMISSION_ERROR` | 无权限安装到环境 | 联系管理员 |
| 磁盘空间 | `DISK_SPACE_ERROR` | 环境磁盘空间不足 | 清理环境或联系管理员 |
| 编译错误 | `BUILD_ERROR` | 包需要编译但环境不支持 | 使用预编译版本或联系管理员 |

#### API 错误响应格式

```json
{
  "error": "DEPENDENCY_INSTALL_FAILED",
  "message": "Failed to install package playwright",
  "details": {
    "failed_package": {
      "name": "playwright",
      "version": "1.40.0",
      "error_type": "NETWORK_ERROR",
      "error_message": "Could not fetch package playwright-1.40.0\nReason: Network timeout after 30s",
      "mirror": "https://pypi.org/simple"
    },
    "completed_packages": [
      {"name": "requests", "version": "2.31.0", "status": "success"},
      {"name": "pydantic", "version": "2.5.0", "status": "success"}
    ],
    "rollback_status": {
      "will_uninstall": ["requests", "pydantic"],
      "message": "Successfully installed packages will be rolled back"
    },
    "suggestions": [
      "检查网络连接是否正常",
      "稍后重新尝试上传",
      "如持续失败，请联系管理员"
    ]
  },
  "log_url": "/api/v1/skills/upload/xxx-xxx-xxx/logs"
}
```

### 4. 完整上传流程交互

整合以上交互，形成完整的上传流程体验。以下展示前端视角的主要步骤，后端执行的加锁、解锁等操作对用户透明：

> **后端透明步骤**（用户无感知）：
> - 加锁运行时环境（流程图步骤 3）
> - 创建 Skill 版本（流程图步骤 14，解锁前执行确保原子性）
> - 解锁运行时环境（流程图步骤 15）

```
用户选择 ZIP 文件
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 1. 文件验证                                      │
  │    显示: "正在验证文件..."                        │
  │    进度条: 短暂显示                              │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 2. 脚本安全扫描                                  │
  │    显示: "正在扫描脚本安全性..."                  │
  │    结果: 无风险 / 风险提示对话框                  │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 3. 依赖解析与预览                                │
  │    显示: 依赖预览对话框                          │
  │    用户: 确认或取消                              │
  └────────┬────────────────────────────────────────┘
           │ 用户确认
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 4. 依赖冲突检测                                  │
  │    无冲突: 直接进入安装                          │
  │    有冲突: 显示冲突对话框                        │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 5. 依赖安装                                      │
  │    显示: 安装进度条                              │
  │    实时: 包名、进度、用时                        │
  └────────┬────────────────────────────────────────┘
           │
           ├───────── 安装失败 ─────────▶ 显示错误详情对话框
           │
           ▼ 安装成功
  ┌─────────────────────────────────────────────────┐
  │ 6. 创建版本                                      │
  │    显示: "正在创建版本..."                       │
  │    结果: 成功消息                                │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 7. 上传完成                                      │
  │    显示: 成功对话框                              │
  │    信息: Skill 名称、版本、依赖数量              │
  │    操作: [查看 Skill] [立即执行]                 │
  └─────────────────────────────────────────────────┘
```

### 5. 前端组件设计建议

#### 依赖预览组件 (DependencyPreviewDialog)

```typescript
interface DependencyPreviewDialogProps {
  skillUuid: string;
  skillName: string;
  pendingVersion: string;
  dependencies: {
    toInstall: PackageInfo[];
    alreadyInstalled: PackageInfo[];
  };
  estimatedDurationSeconds: number;
  onConfirm: () => void;
  onCancel: () => void;
}

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
}
```

#### 安装进度组件 (InstallProgressDialog)

```typescript
interface InstallProgressDialogProps {
  skillUuid: string;
  progress: {
    currentPackage: string;
    currentVersion: string;
    completedPackages: string[];
    totalPackages: number;
    progressPercent: number;
    elapsedSeconds: number;
    estimatedRemainingSeconds: number;
  };
  onCancel: () => void;
}

// 进度更新方式
const useInstallProgress = (skillUuid: string) => {
  // 方案 A: WebSocket
  // 方案 B: 轮询
  const pollProgress = async () => {
    const response = await fetch(`/api/v1/skills/upload/${skillUuid}/progress`);
    return response.json();
  };

  // 每 2 秒轮询一次
  useEffect(() => {
    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [skillUuid]);
};
```

#### 错误详情组件 (InstallErrorDialog)

```typescript
interface InstallErrorDialogProps {
  error: {
    errorType: string;
    failedPackage: PackageErrorInfo;
    completedPackages: PackageStatus[];
    suggestions: string[];
    logUrl: string;
  };
  onRetry: () => void;
  onCancel: () => void;
  onViewLog: () => void;
}

interface PackageErrorInfo {
  name: string;
  version: string;
  errorType: 'NETWORK_ERROR' | 'PACKAGE_NOT_FOUND' | 'VERSION_CONFLICT' | ...;
  errorMessage: string;
  mirror?: string;
}
```


---

**导航**： [← 依赖冲突处理](./07-dependency-conflict.md) | [返回目录](./00-index.md) | [环境清理策略 →](./09-cleanup-strategy.md)