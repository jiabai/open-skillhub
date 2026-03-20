# Open SkillHub 后端设计与开发文档 — MCP 工具设计

> 本文档描述 MCP 工具定义、Skill 生命周期管理、Shell 命令白名单及资源隔离与配额。

---

## 1. MCP 工具定义

### 1.1 工具列表

| 工具名 | 说明 | 输入参数 |
|--------|------|---------|
| `execute_skill` | 在云端执行指定 Skill | `skill_uuid`（必填）、`version`（可选）、`parameters`（可选） |
| `load_skill` | 加载 Skill 的 SKILL.md 内容 | `skill_name`（必填） |
| `load_skill_metadata` | 加载 Skill 的元数据 | `skill_name`（必填） |
| `read_reference_file` | 读取 Skill 目录下的参考文件 | `skill_name`、`file_path` |
| `run_shell_command` | 在 Skill 上下文中执行 Shell 命令 | `command`、`workdir`（可选） |

### 1.2 资源型工具

| 资源名 | 说明 |
|--------|------|
| `skill://list` | 列出当前用户可见的所有 Skill |
| `skill://detail/{skill_name}` | 获取指定 Skill 的详细信息 |

### 1.3 工具注册方式

所有工具通过 FlowLLM 的 `@C.register_op()` 装饰器注册：

```python
@C.register_op()
class ExecuteSkillOp(BaseAsyncToolOp):
    def build_tool_call(self) -> ToolCall:
        return ToolCall(
            name="execute_skill",
            description="Execute a skill from enterprise cloud",
            input_schema={...},
        )
```

---

## 2. Skill 生命周期管理

### 2.1 生命周期阶段

```
创建（create）
    ↓
上传（upload）→ 生成版本（version bump）
    ↓
激活（activate） ←→ 停用（deactivate）
    ↓
执行（execute）
    ↓
下载（download）
```

### 2.2 各阶段说明

| 阶段 | 触发方式 | 说明 |
|------|---------|------|
| 创建 | `POST /api/v1/skills` | 创建 Skill 记录和目录 |
| 上传 | `POST /api/v1/skills/upload` | 上传文件，支持单文件和 ZIP 包 |
| 版本提升 | 上传 ZIP 时自动 | 根据 `SKILL_VERSION_BUMP_STRATEGY` 提升版本号 |
| 激活 | `POST /api/v1/skills/{uuid}/activate` | 将 `is_active=true` |
| 停用 | `POST /api/v1/skills/{uuid}/deactivate` | 将 `is_active=false`，返回 410 |
| 执行 | `execute_skill` MCP 工具 | 调用 Skill 入口脚本 |
| 下载 | `POST /api/v1/skills/download` | 生成加密的 Skill 包下载链接 |

### 2.3 Skill 版本提升策略

通过 `SKILL_VERSION_BUMP_STRATEGY` 配置（仅支持 `patch` 或 `minor`）：

| 策略 | 说明 |
|------|------|
| `patch` | 1.0.0 → 1.0.1（默认） |
| `minor` | 1.0.0 → 1.1.0 |

**注意**：系统不支持 `major` 策略，如需主版本号升级需手动指定版本号。

**版本号格式验证规则**：
- 必须符合 semver 格式：`[v]major.minor.patch`
- 可选 `v` 前缀（如 `v1.0.0` 或 `1.0.0`）
- 长度不超过 100 字符
- 仅允许字母、数字、点、连字符和下划线

### 2.4 缓存与撤销

- Skill 上传或激活/停用时，会设置 `cache_revoked_at` 时间戳
- 下载时检查缓存是否被撤销
- 配置项：
  - `SKILL_CACHE_TTL_SECONDS`（默认 604800，即 7 天）
  - `SKILL_DOWNLOAD_TTL_SECONDS`（默认 3600，即 1 小时）
  - `ENABLE_LOCAL_CACHE_ENCRYPTION`（默认 true）
  - `ENABLE_SKILL_DOWNLOAD_ENCRYPTION`（默认 true）

---

## 3. Shell 命令白名单

### 3.1 允许的基础命令

```python
ALLOWED_COMMANDS = {
    "python",
    "python3",
    "node",
    "npm",
    "bash",
    "sh",
}
```

### 3.2 禁止的模式

| 模式 | 说明 |
|------|------|
| `rm\s+-rf` | 递归强制删除 |
| `sudo` | 提权操作 |
| `>\s*/etc/` | 写入系统目录 |
| `curl.*\|.*bash` | 管道远程脚本执行 |
| `wget.*\|.*sh` | 下载并执行脚本 |
| `\.\./` | 路径穿越（正斜杠） |
| `\.\.\\` | 路径穿越（反斜杠） |

### 3.3 网络出口控制

当 `ENABLE_NETWORK_EGRESS_CONTROL=true` 时，以下模式也被禁止：

- HTTP/HTTPS URL（`https?://`）
- Python 的 `urllib.request`、`requests`、`httpx`
- Node.js 的 `socket`、`websockets`
- 工具：`curl`、`wget`、`ping`、`nslookup`、`traceroute`

### 3.4 验证函数

```python
def validate_command(command: str) -> tuple[bool, str]:
    # 1. 检查基础命令是否在白名单
    # 2. 检查是否匹配 BLOCKED_PATTERNS
    # 3. 检查网络出口模式（如果启用）
    return True, "OK"  # 或 False, "具体错误原因"
```

---

## 4. 资源隔离与配额

### 4.1 并发执行限制

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SKILL_MAX_CONCURRENT_EXECUTIONS_PER_USER` | 4 | 单用户最大并发 |
| `SKILL_MAX_CONCURRENT_EXECUTIONS_PER_TEAM` | 16 | 单团队最大并发 |

**实现方式**：通过 `asyncio.Lock` 实现全局槽位管理。

```python
async def acquire_execution_slot(user_id: str, team_id: str | None):
    # 检查用户槽位
    # 检查团队槽位
    # 占用槽位并返回 release 函数
```

### 4.2 工作目录配额

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SKILL_MAX_WORKDIR_BYTES` | 1073741824（1GB） | 单个 Skill 工作目录最大体积 |

**检查方式**：

```python
def is_within_workdir_quota(path: Path, max_bytes: int | None = None) -> bool:
    total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    return total <= limit
```

### 4.3 输出截断

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SKILL_MAX_OUTPUT_BYTES` | 1048576（1MB） | 单次执行输出最大体积 |

```python
def truncate_output(output: str, max_bytes: int | None = None) -> str:
    if len(output.encode("utf-8")) <= limit:
        return output
    return output[:limit].decode("utf-8", errors="ignore")
```

### 4.4 执行超时

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SKILL_EXECUTION_TIMEOUT_SECONDS` | 300（5分钟） | 单次执行最大耗时 |

### 4.5 沙箱与网络隔离（可选）

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `ENABLE_SANDBOX_EXECUTION` | false | 是否启用沙箱 |
| `ENABLE_NETWORK_EGRESS_CONTROL` | false | 是否启用网络出口控制 |
| `ENABLE_RESOURCE_QUOTA` | false | 是否启用资源配额 |

---

## 5. 文件上传与存储限制

### 5.1 文件大小限制

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MAX_FILE_SIZE` | 10MB (10,485,760 bytes) | 单文件最大大小 |
| `MAX_TOTAL_SIZE` | 100MB (104,857,600 bytes) | 单个 Skill 总大小上限 |
| `MAX_FILES_PER_SKILL` | 50 | 单个 Skill 最大文件数 |

### 5.2 允许的文件扩展名

```python
ALLOWED_EXTENSIONS = {".md", ".py", ".js", ".sh", ".txt", ".json", ".yaml", ".yml"}
```

### 5.3 文件名与路径验证

**文件名验证规则**：
- 长度不超过 255 字符
- 仅允许字母、数字、下划线、连字符和点：`^[a-zA-Z0-9_\-\.]+$`
- 扩展名必须在允许列表中

**路径验证规则**：
- 禁止路径穿越（`..`）
- 禁止绝对路径（以 `/` 开头或包含 `:`）
- 禁止反斜杠（`\`）
- 所有路径组件必须符合文件名规则

---

## 6. MCP 请求认证（用户隔离）

### 6.1 认证流程

```
请求进入 /mcp 或 /sse
    ↓
提取 Authorization: Bearer <token>
    ↓
验证 Token 格式
    ↓
数据库查询 token_hash（API Token）
    ↓
设置用户上下文（set_current_user_id(user_id)）
    ↓
后续 MCP 工具通过 get_current_user_id() 获取用户
```

### 6.2 用户上下文隔离

每个 MCP 工具通过 `get_current_user_id()` 获取当前用户 ID：

```python
async def execute_skill(skill_uuid, version, parameters):
    user_id = get_current_user_id()  # 从 ContextVar 获取
    # 仅返回该用户有权限看到的 Skill 数据
```

这确保了多用户环境下的数据隔离。

---

## 7. 执行流程示例

### 7.1 execute_skill 执行流程

```
1. 验证用户有 skill.execute 权限
2. 校验 skill_uuid 对应的 Skill 存在且可见
3. 获取指定版本（默认 latest）
4. 获取 Skill 工作目录路径
5. 读取版本元数据（dependencies、dependency_spec）
6. 获取执行槽位（acquire_execution_slot）
7. 构造命令（python <entrypoint> 或 node <entrypoint>）
8. 验证命令（validate_command）
9. 执行命令（subprocess），超时控制
10. 记录 tool_call_metrics
11. 审计日志（如果 ENABLE_AUDIT_LOG）
12. 返回执行结果（stdout/stderr）
```

### 7.2 run_shell_command 执行流程

```
1. 验证命令（validate_command）
2. 获取工作目录（workdir 参数，默认为 Skill 目录）
3. 校验工作目录配额（is_within_workdir_quota）
4. 获取执行槽位
5. 执行命令（subprocess）
6. 截断输出（truncate_output）
7. 记录 metrics
8. 返回执行结果
```
