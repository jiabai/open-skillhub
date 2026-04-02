---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 前端交互体验设计

### 1. 依赖列表预览（无冲突场景）

用户上传 Skill ZIP 后，后端解析依赖并检测冲突。**无冲突时**，展示依赖预览对话框让用户确认后再安装。

> **注意**：依赖确认分为两种场景：
> - **冲突场景**：检测到版本冲突，显示冲突对话框，用户决策是否允许升级（调用 `/resolve-conflict`）
> - **预览场景**：无冲突，显示依赖预览对话框，用户确认是否安装（调用 `/confirm-dependencies`）
>
> 这与安全审查确认（`resolve-security`）是独立的确认步骤：
> - **安全审查确认**：针对脚本扫描发现的风险操作，用户确认是否继续上传

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

> **API 定义**：依赖确认相关接口的完整定义请参考 [API 设计 - 上传接口扩展](./06-api-design.md#1-上传接口扩展)。
> - `/confirm-dependencies`：确认依赖预览（无冲突时）
> - `/resolve-conflict`：解决版本冲突（有冲突时）
> - `/resolve-security`：解决安全审查确认

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
| 网络错误 | `DEPENDENCY_NETWORK_ERROR` | 无法连接 PyPI 或下载超时 | 检查网络，稍后重试 |
| 包不存在 | `DEPENDENCY_PACKAGE_NOT_FOUND` | PyPI 上不存在该包或版本 | 检查包名/版本是否正确 |
| 版本冲突 | `DEPENDENCY_VERSION_CONFLICT` | 与其他已安装包版本冲突 | 查看冲突详情，调整依赖 |
| 权限错误 | `DEPENDENCY_PERMISSION_ERROR` | 无权限安装到环境 | 联系管理员 |
| 磁盘空间 | `DEPENDENCY_DISK_SPACE_ERROR` | 环境磁盘空间不足 | 清理环境或联系管理员 |
| 编译错误 | `DEPENDENCY_BUILD_ERROR` | 包需要编译但环境不支持 | 使用预编译版本或联系管理员 |

> **注意**：前端错误类型应与 `10-error-handling.md` 中定义的错误码保持一致，统一使用 `DEPENDENCY_` 前缀。

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
  │    结果:                                         │
  │    - 无风险/LOW: 继续下一步                      │
  │    - HIGH 级别: 显示拒绝对话框，流程终止          │
  │    - MEDIUM 级别: 显示安全审查确认对话框          │
  │      用户确认后继续下一步                         │
  │                                                  │
  │    MEDIUM 风险确认流程:                          │
  │    - 显示风险详情对话框                          │
  │    - 用户点击"了解风险并继续上传"                │
  │    - 调用 POST /resolve-security                 │
  │    - 继续步骤 3                                  │
  └────────┬────────────────────────────────────────┘
           │ 无风险/LOW 或用户确认 MEDIUM 风险
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 3. 依赖解析与冲突检测                            │
  │    显示: "正在解析依赖..."                       │
  │    后端完成解析后检测冲突                        │
  └────────┬────────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────┐
  │ 4. 显示依赖确认对话框                            │
  │    根据检测结果显示不同内容：                    │
  │                                                  │
  │    有冲突 (status="conflict"):                   │
  │    → 显示冲突对话框                              │
  │    → 高亮显示冲突项                              │
  │    → 用户选择"允许安装"或"取消上传"              │
  │                                                  │
  │    无冲突 (status="dependency_preview"):          │
  │    → 显示依赖预览对话框                          │
  │    → 展示待安装和已安装依赖列表                  │
  │    → 用户选择"确认并安装"或"取消上传"            │
  └────────┬────────────────────────────────────────┘
           │ 用户确认（允许安装 或 确认并安装）
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

**流程说明**：
- 步骤 3-4 合并为"依赖解析与确认"阶段，后端先完成解析和冲突检测，再根据结果返回不同状态
- `status="conflict"` 时显示冲突对话框，用户需决策是否允许升级依赖
- `status="dependency_preview"` 时显示依赖预览对话框，用户确认后开始安装
- 用户取消（无论冲突还是预览场景）都会触发回滚并解锁

### 5. 前端组件设计建议

#### 依赖预览组件 (DependencyPreviewDialog)

```typescript
interface DependencyPreviewDialogProps {
  skillUuid: string;
  skillName: string;
  pendingVersion: string;
  dependencies: {
    to_install: PackageInfo[];      // 与 API 响应一致（snake_case）
    already_installed: PackageInfo[];
  };
  estimatedDurationSeconds: number;
  onConfirm: () => void;
  onCancel: () => void;
}

interface PackageInfo {
  name: string;
  version: string;
  reason?: string;  // "new_dependency" | "upgrade_required"
  description?: string;
}
```

> **注意**：字段命名使用 snake_case 以与后端 API 响应保持一致。前端可在组件内部转换为 camelCase 用于内部状态管理。
```

#### 冲突对话框组件（含升级影响预检）

当检测到依赖冲突时，前端除显示冲突详情外，还应展示受影响的 Skill 列表（如果有）：

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ⚠️ 依赖版本冲突                                │
└─────────────────────────────────────────────────────────────────────┘

以下包的版本与您环境中已安装的版本不兼容：

┌─────────────────────────────────────────────────────────────────────┐
│  • requests                                                        │
│    已安装: 2.28.0    需要: >=2.30.0                                 │
└─────────────────────────────────────────────────────────────────────┘

⚠️ 升级后以下 Skill 可能受到影响：

┌─────────────────────────────────────────────────────────────────────┐
│  • Skill B                                                          │
│    问题: requests 需求 >=2.28.0，升级到 2.30.0 后可能不兼容        │
│                                                                    │
│  • Skill C                                                          │
│    问题: requests 需求 ==2.28.0，升级到 2.30.0 后将不兼容          │
└─────────────────────────────────────────────────────────────────────┘

提示：系统将在安装前自动保存依赖快照，如有问题可从快照恢复。

选择操作：

[允许安装]  [取消上传]
```

```typescript
interface ConflictDialogProps {
  skillUuid: string;
  conflicts: ConflictInfo[];
  affectedSkills?: AffectedSkillInfo[];  // 升级影响预检结果（可能为空）
  onProceed: () => void;
  onCancel: () => void;
}

interface ConflictInfo {
  package: string;
  installed_version: string;
  required_version: string;
  conflict_type: string;
}

interface AffectedSkillInfo {
  skill_name: string;
  breaks: {
    package: string;
    installed_version: string;
    required_version: string;
  }[];
}
```

#### 依赖快照历史组件

在用户环境管理页面，展示依赖快照历史并提供恢复入口：

```
┌─────────────────────────────────────────────────────────────────────┐
│                        依赖快照历史                                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  快照时间              | 原因                        | 操作         │
├─────────────────────────────────────────────────────────────────────┤
│  2026-04-02 15:00     | 上传 Skill A v2.0 前自动保存 | [恢复到此版本]│
│  2026-03-28 10:00     | 上传 Skill C v1.0 前自动保存 | [恢复到此版本]│
│  2026-03-15 09:00     | 手动保存                     | [恢复到此版本]│
│  2026-03-10 14:00     | 上传 Skill B v1.0 前自动保存 | [恢复到此版本]│
└─────────────────────────────────────────────────────────────────────┘

提示：恢复快照会将您的依赖环境切换到指定时间点的状态。
      恢复前系统会自动保存当前状态作为备份。
      恢复操作不可撤销，请确认后操作。
```

```typescript
interface SnapshotHistoryProps {
  snapshots: SnapshotInfo[];
  onRestore: (snapshotId: string) => void;
}

interface SnapshotInfo {
  snapshot_id: string;
  created_at: string;
  reason: string;
  is_auto: boolean;
  dependencies: Record<string, string>;
}
```

#### 安装进度组件 (InstallProgressDialog)

```typescript
interface InstallProgressDialogProps {
  skillUuid: string;
  progress: {
    current_package: string;        // 与 API 响应一致（snake_case）
    current_version: string;
    completed_packages: string[];
    total_packages: number;
    progress_percent: number;
    elapsed_seconds: number;
    estimated_remaining_seconds: number;
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