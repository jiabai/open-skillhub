# 工具文档（Tool Documentation）

> **当前版本**: v2.0（支持多用户隔离）
>
> 本文档描述支持用户隔离的 MCP 工具接口。与旧版本相比，主要区别在于支持用户隔离的 Skill 路径。

---

## 版本历史

| 版本 | 描述 | 主要变更 |
|------|------|---------|
| **v2.0** (当前) | 多用户版本 | 支持用户隔离、（FastAPI 模式）Web API(JWT) + MCP(API Token) 认证、私有 Skill 空间 |
| v1.0 | 单用户版本 | 原始版本，无用户隔离 |

---

## 版本差异

| 特性 | 单用户版本 | 多用户版本 |
|------|-----------|-----------|
| Skill路径 | `{skill_dir}/{skill_name}/` | `{skill_dir}/{user_id}/{skill_name}/` |
| 用户隔离 | 无 | 每个用户独立的Skill空间 |
| 认证方式 | 无 | Web API 使用 JWT；MCP 使用 Bearer（优先 API Token `ask_live_...`，兼容 JWT Access Token） |
| 向后兼容 | - | 支持（无user_id时使用全局路径） |

---

## 术语说明

- `skill_dir`: 指 FlowLLM 的 `C.service_config.metadata["skill_dir"]`，基础 4 个 MCP 工具均基于该路径读写 Skill 文件
- FastAPI 模式: 启动时会将 `skill_dir` 设置为 `SKILL_STORAGE_PATH`（环境变量），两者等价
- 本地 stdio/SSE 模式: `skill_dir` 通常来自 FlowLLM 配置项 `metadata.skill_dir`，可与 `SKILL_STORAGE_PATH` 不同

---

Open SkillHub 提供 7 个工具：基础 4 个技能文件工具 + 企业接口对齐 3 个资源/执行工具，并参考 [Anthropic 的 Agent Skills 工程实践](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) 来实现 *Progressive Disclosure* 架构。

---

## Tool 1: load_skill_metadata

<p align="left">
  <em>Load metadata from all available skills (always call at task start).</em>
</p>

### Description

This tool scans the skills directory recursively for SKILL.md files and extracts their metadata (name and description) from YAML frontmatter.

**多用户版本**: 当存在 `user_id` 时，仅扫描该用户的私有Skill目录；否则扫描全局Skill目录。

### Key Operation Flow

- Gets the skills directory path from `C.service_config.metadata["skill_dir"]`
- **多用户**: 从请求级上下文获取 `user_id`（通过 `contextvars`）
- **多用户**: 根据用户ID确定搜索目录: `{skill_dir}/{user_id}/` 或 `{skill_dir}/`
- Recursively searches for all SKILL.md files
- Parses each file's frontmatter to extract metadata
- Builds a formatted text list (each line is "- <skill_name>: <skill_description>")
- Sets the output with the complete formatted text

### Input Parameters

This tool requires no input parameters.

**多用户版本内部逻辑**:
```python
from skillhub.core.utils.user_context import get_current_user_id

user_id = get_current_user_id()  # 从请求级上下文获取
skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

if user_id:
    search_dir = skill_dir / user_id  # 用户私有目录
else:
    search_dir = skill_dir            # 全局目录（向后兼容）
```

> **注意**: 在 FastAPI 模式下，`user_id` 会在 MCP 认证中间件中通过 `contextvars` 注入到请求级上下文。每个 HTTP 请求会根据 API Token 自动识别用户身份，确保多用户并发访问时的安全隔离。FlowLLM 本地模式下通常不会注入 `user_id`，因此会退化为全局 Skill 目录。详见 [project-spec.md](./project-spec.md#62-并发安全机制)。

### Returns

str: A string containing the skill metadata in the format:
```
Available skills (each line is "- <skill_name>: <skill_description>"):
- skill_name_1: Skill description 1
- skill_name_2: Skill description 2
...
```

### Test Demo

```bash
python tests/test_load_skill_metadata_op.py <path/to/skills>
```

---

## Tool 2: `load_skill`

<p align="left">
  <em>Load a specific skill's instructions (i.e., SKILL.md).</em>
</p>

### Description

This tool loads the content of a SKILL.md file for a given skill name and returns the file content as-is.

**多用户版本**: 根据用户ID构建正确的Skill路径。

### Key Operation Flow

- Takes a skill_name as input
- **多用户**: 从上下文获取 `user_id`
- **多用户**: 构建路径: `{skill_dir}/{user_id}/{skill_name}/SKILL.md` 或 `{skill_dir}/{skill_name}/SKILL.md`
- Reads the SKILL.md file from that directory
- Returns the file content without stripping YAML frontmatter

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `skill_name` | string | Yes | - | Name of the skill |

**多用户版本内部逻辑**:
```python
from skillhub.core.utils.user_context import get_current_user_id

skill_name = self.input_dict["skill_name"]
user_id = get_current_user_id()  # 从请求级上下文获取
skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

if user_id:
    skill_path = skill_dir / user_id / skill_name / "SKILL.md"
else:
    skill_path = skill_dir / skill_name / "SKILL.md"
```

### Returns

str: The skill instructions content (complete SKILL.md file including YAML frontmatter). If the SKILL.md file exists, returns the file content as-is. Otherwise, returns a JSON string payload produced by `tool_error_payload` (including `detail`, `code`, and `timestamp`).

> [!NOTE]
> Unlike the description in earlier versions, this tool returns the **complete** SKILL.md file content including YAML frontmatter. The frontmatter is **not** stripped.

> [!TIP]
> You can refer to [official Anthropic documentation](https://code.claude.com/docs/en/skills) on the Skills format.

### Test Demo

```bash
python tests/test_load_skill_op.py <path/to/skills> <skill_name>
```

---

## Tool 3: read_reference_file

<p align="left">
  <em>Read reference files from a skill directory.</em>
</p>

### Description

This tool allows reading reference files like forms.md, reference.md, or ooxml.md from a specific skill's directory.

**多用户版本**: 根据用户ID构建正确的文件路径。

### Key Operation Flow

- Takes a skill_name and file_name as input
- **多用户**: 从上下文获取 `user_id`
- **多用户**: 构建路径: `{skill_dir}/{user_id}/{skill_name}/{file_name}` 或 `{skill_dir}/{skill_name}/{file_name}`
- Reads the file content if it exists
- Returns the file content or an error message if not found

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `skill_name` | string | Yes | - | Name of the skill |
| `file_name` | string | Yes | - | The reference file name or file path relative to the skill directory |

**多用户版本内部逻辑**:
```python
from skillhub.core.utils.user_context import get_current_user_id

skill_name = self.input_dict["skill_name"]
file_name = self.input_dict["file_name"]
user_id = get_current_user_id()  # 从请求级上下文获取
skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

if user_id:
    file_path = skill_dir / user_id / skill_name / file_name
else:
    file_path = skill_dir / skill_name / file_name
```

### Returns

str: The content of the reference file read from the skill directory. If the file is not found, returns a JSON string payload produced by `tool_error_payload` (including `detail`, `code`, and `timestamp`).

### Test Demo

```bash
python tests/test_reference_file_op.py <path/to/skills> <skill_name> <file_name>
```

---

## Tool 4: run_shell_command

<p align="left">
  <em>Execute shell commands to run scripts within skill directories.</em>
</p>

### Description

This tool executes shell commands. Optionally (disabled by default), it can automatically detect and install dependencies for Python scripts via pipreqs (when pipreqs is available and server-side auto-install is enabled). The command is executed in the skill's directory context, allowing scripts to access skill-specific files and resources.

**多用户版本**: 在用户私有的Skill目录中执行命令。

> **⚠️ 安全警告**: 出于安全考虑，该工具在多用户环境下仅允许执行**白名单内的安全命令**（如 `python`, `node`, `bash` 等），且严禁包含危险操作（如 `rm -rf`, `sudo` 等）。任何未授权的命令执行请求都将被拒绝。详见 [安全规范](./project-spec.md#105-runshellcommandop-安全增强建议)。

### 执行控制特性

当启用资源配额 (`ENABLE_RESOURCE_QUOTA=true`) 时，该工具还支持：

| 特性 | 配置项 | 说明 |
|------|--------|------|
| 执行超时 | `SKILL_EXECUTION_TIMEOUT_SECONDS` | 命令执行超时时间（秒），超时后自动终止进程 |
| 工作目录配额 | `MAX_WORKDIR_BYTES` | Skill 工作目录最大字节数限制 |
| 并发控制 | `MAX_CONCURRENT_EXECUTIONS` | 同时执行的最大命令数 |
| 输出截断 | `MAX_OUTPUT_BYTES` | 命令输出最大字节数 |
| 沙箱执行 | `ENABLE_SANDBOX_EXECUTION` | 仅传递 PATH 环境变量，隔离执行环境 |

### Key Operation Flow

- Extract skill_name and command from input
- **多用户**: 从上下文获取 `user_id`
- **多用户**: 确定工作目录: `{skill_dir}/{user_id}/{skill_name}/` 或 `{skill_dir}/{skill_name}/`
- For Python commands, optionally detect and install dependencies using pipreqs (if available and server-side auto-install is enabled)
- Execute the command in a subprocess and capture stdout/stderr
- Return the combined output (stdout + stderr)

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `skill_name` | string | Yes | - | Name of the skill |
| `command` | string | Yes | - | The shell command to execute |

**多用户版本内部逻辑**:
```python
from skillhub.core.utils.user_context import get_current_user_id
from skillhub.core.utils.command_whitelist import validate_command
from skillhub.core.utils.skill_storage import tool_error_payload

skill_name = self.input_dict["skill_name"]
command = self.input_dict["command"]
user_id = get_current_user_id()  # 从请求级上下文获取
skill_dir = Path(C.service_config.metadata["skill_dir"]).resolve()

# 安全检查
is_valid, error_msg = validate_command(command)
if not is_valid:
    return tool_error_payload(error_msg, "COMMAND_BLOCKED")

if user_id:
    work_dir = skill_dir / user_id / skill_name
else:
    work_dir = skill_dir / skill_name
```

### Returns

str: On success, returns the combined stdout and stderr output from the command execution (decoded as UTF-8) and formatted as: "{stdout}\n{stderr}". If the command is blocked, returns a JSON string payload from `tool_error_payload` (for example with `code` = "COMMAND_BLOCKED").

> [!NOTE]
> Dependency auto-installation is disabled by default and only occurs for commands containing "py" when server-side auto-install is enabled.
> The command runs in the skill's directory, allowing access to skill-specific files and resources.

### Test Demo

```bash
python tests/test_run_shell_command_op.py <path/to/skills> <skill_name> <command>
```

---

## Tool 5: skill_list_resource

<p align="left">
  <em>Return MCP Resource payload for `skill://list`.</em>
</p>

### Description

返回当前用户可见技能列表，输出 MCP Resource 结构，`uri` 为 `skill://list`。

### Input Parameters

该工具无输入参数。

### Returns

`str`：JSON 字符串，格式为：

```json
{
  "contents": [
    {
      "uri": "skill://list",
      "mimeType": "application/json",
      "text": "{\"skills\": [...]}"
    }
  ]
}
```

`text` 字段解析后的 `skills` 数组中每项包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `skill_id` | string | Skill UUID |
| `name` | string | Skill 名称 |
| `version` | string | 当前版本 |
| `description` | string | Skill 描述 |
| `author` | string | 作者用户 ID |
| `visible` | string | 可见性：`private` / `team` / `enterprise` |
| `created_at` | string | 创建时间（ISO 8601） |
| `updated_at` | string | 更新时间（ISO 8601） |
| `tags` | array | 标签列表 |
| `deprecation_info` | object | 废弃信息：`{deprecated: bool, sunset: string|null}` |

### 权限要求

- 需要 `skill.list` 权限
- 仅返回用户可见的 Skills（根据 visibility 和用户所属组织过滤）

---

## Tool 6: skill_detail_resource

<p align="left">
  <em>Return MCP Resource payload for `skill://{skill_uuid}@{version}`.</em>
</p>

### Description

返回技能详情资源，包含版本、依赖、参数定义与可见性信息。

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `skill_uuid` | string | Yes | - | Skill UUID |
| `version` | string | No | 当前版本/最新版本 | 目标版本 |

### Returns

`str`：JSON 字符串，`uri` 形如 `skill://{skill_uuid}@{version}`，`text` 为技能详情 JSON。

`text` 字段解析后的结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `skill_id` | string | Skill UUID |
| `version` | string | 版本号 |
| `name` | string | Skill 名称 |
| `description` | string | Skill 描述 |
| `author` | string | 作者用户 ID |
| `parameters` | object | 参数定义（从 SKILL.md frontmatter 解析） |
| `dependencies` | array | 依赖列表 |
| `visible` | string | 可见性：`private` / `team` / `enterprise` |
| `created_at` | string | 创建时间（ISO 8601） |
| `updated_at` | string | 更新时间（ISO 8601） |
| `dependency_spec` | object | 依赖规格（多生态声明，如 Python/Node） |

### 权限要求

- 需要 `skill.read` 权限
- 仅返回用户可见的 Skill（根据 visibility 校验）

---

## Tool 7: execute_skill

<p align="left">
  <em>Execute a skill by version with RBAC and visibility checks.</em>
</p>

### Description

按 `skill_uuid` 与可选 `version` 执行技能。执行命令从目标版本 `SKILL.md` 的 `command` 或 `entrypoint` 推导，受命令白名单限制；输入参数通过 `SKILL_PARAMS` 注入环境变量。

### 执行控制特性

当启用资源配额 (`ENABLE_RESOURCE_QUOTA=true`) 时，该工具支持：

| 特性 | 配置项 | 说明 |
|------|--------|------|
| 执行超时 | `SKILL_EXECUTION_TIMEOUT_SECONDS` | 命令执行超时时间（秒），超时后自动终止进程 |
| 工作目录配额 | `MAX_WORKDIR_BYTES` | Skill 工作目录最大字节数限制 |
| 并发控制 | `MAX_CONCURRENT_EXECUTIONS` | 同时执行的最大命令数 |
| 输出截断 | `MAX_OUTPUT_BYTES` | 命令输出最大字节数 |
| 沙箱执行 | `ENABLE_SANDBOX_EXECUTION` | 仅传递 PATH 和 SKILL_PARAMS 环境变量 |

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `skill_uuid` | string | Yes | - | Skill UUID |
| `version` | string | No | 当前版本/最新版本 | 目标版本 |
| `parameters` | object | No | `{}` | 技能执行参数 |

### Returns

`str`：JSON 字符串，格式为：

```json
{
  "result": {
    "status": "success|error|timeout",
    "output": "...",
    "execution_time_ms": 123
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 执行状态：`success` / `error` / `timeout` |
| `output` | string | 命令输出（stdout + stderr） |
| `execution_time_ms` | int | 执行耗时（毫秒） |

### 权限要求

- 需要 `skill.execute` 权限
- 仅可执行用户可见的 Skill（根据 visibility 校验）

### 错误码

| 错误码 | 说明 |
|--------|------|
| `UNAUTHORIZED` | 未认证（缺少 user_id） |
| `PERMISSION_DENIED` | 无 `skill.execute` 权限 |
| `SKILL_NOT_FOUND` | Skill 不存在或不可见 |
| `SKILL_DEACTIVATED` | Skill 已下架 |
| `VERSION_NOT_FOUND` | 版本不存在 |
| `SKILL_MD_NOT_FOUND` | SKILL.md 文件不存在 |
| `SKILL_EXECUTION_NOT_CONFIGURED` | Skill 未配置 command 或 entrypoint |
| `COMMAND_BLOCKED` | 命令被白名单拦截 |
| `QUOTA_EXCEEDED` | 工作目录配额超限 |
| `CONCURRENCY_LIMIT` | 并发执行数超限 |

### 审计日志

当 `ENABLE_AUDIT_LOG=true` 时，每次执行会记录审计日志：
- `action`: `skill.execute`
- `result`: `success` / `error` / `timeout`
- `metadata`: `{version, execution_time_ms}`

---

## 多用户版本使用示例

### MCP客户端配置

```json
{
  "mcpServers": {
    "skillhub-mcp": {
      "type": "http",
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer ask_live_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      }
    }
  }
}
```

### 认证流程

1. 用户通过 `/api/v1/auth/login` 获取 JWT Token
2. 通过 `/api/v1/tokens` 创建 API Token
3. 使用 API Token 访问 MCP 服务
4. MCP 服务自动识别用户身份，访问其私有 Skill 空间

> **并发安全**: API Token 验证成功后，用户 ID 会通过 `contextvars` 注入到请求级上下文。这意味着每个并发请求都能正确识别自己的用户身份，不会相互干扰。详见 [project-spec.md](./project-spec.md#62-并发安全机制)。

### Skill 隔离机制

```
/data/skills/
├── {user_id_1}/
│   ├── pdf/
│   │   ├── SKILL.md
│   │   └── reference.md
│   └── xlsx/
│       └── SKILL.md
├── {user_id_2}/
│   └── pdf/
│       └── SKILL.md
└── ...
```

每个用户只能访问自己目录下的 Skills，确保数据隔离和安全性。
