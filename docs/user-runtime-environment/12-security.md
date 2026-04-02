---
status: draft
ai_read: true
last_updated: 2026-03-31
parent: user-runtime-environment
---

## 安全考虑

### 1. 安全隔离层级选择（ADR-001）

#### 背景

Skill 脚本需要在服务端执行，需要选择合适的隔离层级以平衡安全性和实现复杂度。

#### 选项分析

| 方案 | 安全性 | 实现复杂度 | 性能开销 |
|------|--------|-----------|----------|
| subprocess + venv | 弱 | 低 | 无 |
| subprocess + 环境清理 + 脚本扫描（当前） | 中低 | 低 | 无 |
| Docker 容器 | 强 | 中 | 中 |
| Docker + 网络隔离 | 很强 | 中高 | 中高 |

#### 决策

选择 **subprocess + 环境变量清理 + 脚本扫描** 方案。

#### 理由

- **用户信任模型**：系统面向内部员工/可信用户，恶意攻击概率低
- **实现成本**：无需引入容器基础设施，运维复杂度低
- **性能优先**：无容器启动开销，执行响应快
- **风险可控**：通过环境清理和脚本扫描，可缓解主要风险

#### 已知风险与接受

| 风险 | 缓解措施 | 残余风险 | 接受理由 |
|------|----------|----------|----------|
| 文件系统越界 | 脚本扫描 + 权限审计 | 中 | 内部用户可信，审计可追溯 |
| 环境变量泄露 | 环境变量清理 | 低 | 已缓解 |
| 网络无限制 | 脚本扫描敏感域名 | 中 | 内网服务有独立认证 |
| 依赖注入 | 仅允许 PyPI 官方源 | 低 | 已缓解 |

### 2. 环境变量清理

执行 Skill 时清理环境变量，仅保留必要变量，防止敏感信息泄露。

#### 清理策略

```python
# backend/services/skill_executor.py

import os
import platform

def build_safe_environment(
    user: User,
    skill_path: Path,
    venv_path: Path,
    params: dict,
) -> tuple[dict[str, str], Path]:
    """
    构建安全的执行环境变量

    清理所有继承的环境变量，仅保留必要变量

    注意：此函数创建临时目录，执行完成后应由调用方清理。
    使用唯一标识确保每次执行有独立的临时空间，避免并发冲突。

    Returns:
        tuple[dict[str, str], Path]: (环境变量字典, 临时目录路径)
        - 环境变量字典: 包含 PATH、SKILL_PARAMS、PYTHONPATH 等清理后的环境变量
        - 临时目录路径: 执行期间使用的临时工作目录，调用方需负责清理
    """
    import uuid

    # 获取 venv 的 bin 目录（根据平台判断）
    if platform.system() == "Windows":
        venv_bin = venv_path / "Scripts"
    else:
        venv_bin = venv_path / "bin"

    # 创建临时工作目录（使用唯一标识避免并发冲突）
    # 使用 tempfile.gettempdir() 确保跨平台兼容
    # Windows: %TEMP% 或 %TMP% (如 C:\Users\xxx\AppData\Local\Temp)
    # Linux/Mac: /tmp
    import tempfile
    temp_dir = Path(tempfile.gettempdir()) / f"skill_{user.id}_{uuid.uuid4().hex[:8]}"

    # 创建临时目录
    temp_dir.mkdir(parents=True, exist_ok=True)

    # 基础环境变量字典
    safe_env = {
        # PATH: 仅用户 venv 的 bin 目录
        # 注意：此设计限制脚本无法调用系统工具（如 git, curl, ffmpeg 等）
        # 如需使用系统工具，可通过以下方式解决：
        #   1. 在 Skill 中打包所需工具（推荐）
        #   2. 申请特殊权限（管理员配置宽松模式）
        #   3. 使用 Skill 自带的 subprocess 调用（需通过安全扫描）
        "PATH": str(venv_bin),

        # Skill 参数
        "SKILL_PARAMS": json.dumps(params),

        # Python 路径
        "PYTHONPATH": str(skill_path),
        "PYTHONIOENCODING": "utf-8",

        # 临时目录隔离
        "HOME": str(temp_dir),
        "TMPDIR": str(temp_dir),
        "TEMP": str(temp_dir),
        "TMP": str(temp_dir),

        # 基础环境
        "LANG": "en_US.UTF-8",
        "LC_ALL": "en_US.UTF-8",
    }

    # Windows 平台必需的系统变量
    # SystemRoot: Python subprocess 和系统 API 调用需要此变量
    # Windows DLL 加载、路径解析等功能依赖 SystemRoot
    if platform.system() == "Windows":
        system_root = os.environ.get("SystemRoot", "C:\\Windows")
        safe_env["SystemRoot"] = system_root
        # Windows 特定的临时目录变量已在上方设置（TEMP/TMP）

    # 不继承任何服务器敏感环境变量
    # 特别是：DATABASE_URL、SECRET_KEY、API_KEY 等

    return safe_env, temp_dir
```

#### PATH 限制说明

执行环境中的 PATH 仅包含用户虚拟环境的 bin 目录，**不包括系统 PATH**。这意味着：

| 限制 | 影响 | 解决方案 |
|------|------|---------|
| 无法调用 `git` | 不能执行 git 命令 | 使用 Python 库如 `pygit2` 或打包 git |
| 无法调用 `curl/wget` | 不能下载外部文件 | 使用 Python 库如 `requests` |
| 无法调用 `ffmpeg` | 不能处理视频/音频 | 打包 ffmpeg 二进制到 Skill 目录 |
| 无法调用系统命令 | 不能执行 `ls`, `cat` 等 | 使用 Python 标准库替代 |

**替代方案（需要管理员配置）**：

```yaml
# config/default.yaml
runtime:
  # PATH 模式：strict（仅 venv）或 relaxed（包含系统 PATH）
  # relaxed 模式会继承服务器 PATH，安全性降低，仅用于特殊场景
  path_mode: "strict"
```

**relaxed 模式的 PATH 构建**：

```python
import os

def build_relaxed_environment(venv_bin: Path, system_path: str) -> dict[str, str]:
    """宽松模式：venv 优先，但不排除系统 PATH"""
    return {
        "PATH": f"{venv_bin}{os.pathsep}{system_path}",  # venv 优先，使用系统正确的分隔符
        # ... 其他环境变量
    }
```

> **跨平台注意**：使用 `os.pathsep` 而非硬编码分隔符。Windows 使用 `;`，Linux/macOS 使用 `:`。

#### 执行时应用

```python
import shutil

async def execute_skill(user: User, skill: Skill, params: dict):
    # 获取路径
    venv_path = Path(user.venv_path)
    skill_path = Path(skill.version_path)
    python_path = get_python_path(venv_path)

    # 获取脚本入口文件（字段已在 Skill 模型中定义）
    script_file = skill.script_file

    # 构建安全环境变量（返回元组：环境变量字典, 临时目录路径）
    safe_env, temp_dir = build_safe_environment(user, skill_path, venv_path, params)

    try:
        # 执行脚本
        proc = await asyncio.create_subprocess_exec(
            str(python_path),
            str(skill_path / "scripts" / script_file),
            env=safe_env,  # 使用清理后的环境
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()
        # ... 处理结果
    finally:
        # 清理临时目录
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
```

### 3. 脚本安全扫描

上传 Skill 时扫描脚本内容，检测潜在风险模式。

#### 风险模式定义

```python
# backend/services/script_scanner.py

from dataclasses import dataclass
from enum import Enum
import re

class RiskLevel(Enum):
    LOW = "low"       # 提示但允许
    MEDIUM = "medium" # 需要确认
    HIGH = "high"     # 拒绝上传

@dataclass
class RiskPattern:
    pattern: str
    description: str
    level: RiskLevel

# 风险模式列表
RISK_PATTERNS: list[RiskPattern] = [
    # HIGH: 拒绝上传
    RiskPattern(r"os\.system\s*\(", "执行系统命令", RiskLevel.HIGH),
    RiskPattern(r"subprocess\.(call|run|Popen)\s*\([^)]*shell\s*=\s*True", "Shell 命令执行", RiskLevel.HIGH),
    RiskPattern(r"eval\s*\(", "动态代码执行", RiskLevel.HIGH),
    RiskPattern(r"exec\s*\(", "动态代码执行", RiskLevel.HIGH),
    RiskPattern(r"__import__\s*\(", "动态模块加载", RiskLevel.HIGH),
    RiskPattern(r"compile\s*\(", "动态代码编译", RiskLevel.HIGH),
    RiskPattern(r"pickle\.loads", "Pickle 反序列化（可导致任意代码执行）", RiskLevel.HIGH),

    # HIGH: 敏感文件访问（Unix）
    RiskPattern(r"open\s*\(\s*[\'\"]\/etc\/", "读取系统配置文件", RiskLevel.HIGH),
    RiskPattern(r"open\s*\(\s*[\'\"]\/var\/log\/", "读取系统日志", RiskLevel.HIGH),
    RiskPattern(r"open\s*\(\s*[\'\"]\/app\/config\/", "读取应用配置", RiskLevel.HIGH),
    # 注意：此正则检测访问非当前用户的 Skill 目录
    RiskPattern(r"os\.path\.join\s*\([^)]*['\"]\/data\/skills['\"]\s*,\s*[^f]", "访问其他用户 Skill 目录", RiskLevel.HIGH),
    RiskPattern(r"\/proc\/", "读取进程信息", RiskLevel.HIGH),

    # HIGH: 敏感文件访问（Windows）
    RiskPattern(r"open\s*\(\s*[\'\"]([A-Za-z]:\\|\\\\)", "读取 Windows 绝对路径文件", RiskLevel.HIGH),
    RiskPattern(r"os\.environ\s*\[", "读取环境变量", RiskLevel.HIGH),
    RiskPattern(r"winreg\.", "Windows 注册表操作", RiskLevel.HIGH),

    # HIGH: 敏感配置文件读取
    RiskPattern(r"yaml\.load\s*\([^)]*,\s*Loader\s*=\s*None", "不安全的 YAML 加载（可导致任意代码执行）", RiskLevel.HIGH),
    RiskPattern(r"yaml\.load\s*\((?:(?!Loader)[^)])*\)", "未指定 Loader 的 YAML 加载（潜在风险）", RiskLevel.HIGH),
    RiskPattern(r"\.env['\"]", "访问 .env 文件", RiskLevel.HIGH),

    # HIGH: 高风险导入
    RiskPattern(r"from\s+os\s+import\s+system", "导入系统命令函数", RiskLevel.HIGH),

    # MEDIUM: 需要确认
    RiskPattern(r"subprocess\.(call|run|Popen)\s*\(", "子进程调用", RiskLevel.MEDIUM),
    RiskPattern(r"socket\.", "网络 Socket 操作", RiskLevel.MEDIUM),
    # HTTP 请求检测：仅标记 requests 模块的使用，无法检测 URL 来源
    # 正则无法捕获变量传递的 URL（如 requests.get(url)），因此简化为检测方法调用本身
    # 实际安全审查需人工确认脚本中的 URL 来源和目标
    RiskPattern(r"requests\.(get|post|put|delete|patch|head|options)\s*\(", "HTTP 请求库调用（需人工确认 URL 来源）", RiskLevel.MEDIUM),
    RiskPattern(r"aiohttp\.(get|post|put|delete|patch)\s*\(", "异步 HTTP 请求库调用", RiskLevel.MEDIUM),
    RiskPattern(r"httpx\.(get|post|put|delete|patch)\s*\(", "HTTPX 请求库调用", RiskLevel.MEDIUM),
    RiskPattern(r"urllib\.request\.urlopen\s*\(", "urllib HTTP 请求", RiskLevel.MEDIUM),
    RiskPattern(r"ftplib|smtplib|telnetlib", "网络协议库使用", RiskLevel.MEDIUM),
    RiskPattern(r"marshal\.loads", "Marshal 反序列化风险", RiskLevel.MEDIUM),

    # MEDIUM: 高风险模块导入
    RiskPattern(r"import\s+ctypes", "导入 ctypes（可调用系统库）", RiskLevel.MEDIUM),
    RiskPattern(r"from\s+subprocess\s+import", "导入子进程模块", RiskLevel.MEDIUM),
    RiskPattern(r"importlib\.import_module", "动态模块加载", RiskLevel.MEDIUM),

    # LOW: 提示但允许
    RiskPattern(r"open\s*\(", "文件操作", RiskLevel.LOW),
    RiskPattern(r"os\.path\.", "路径操作", RiskLevel.LOW),
    RiskPattern(r"shutil\.", "文件系统操作", RiskLevel.LOW),
    RiskPattern(r"tempfile\.", "临时文件操作", RiskLevel.LOW),
    RiskPattern(r"warnings\.", "警告模块使用", RiskLevel.LOW),
    RiskPattern(r"logging\.", "日志模块使用", RiskLevel.LOW),
]
```

#### 扫描局限性说明 ⚠️

> **重要安全提示**：以下局限性意味着恶意用户可能绕过安全扫描。脚本扫描仅作为**第一道防线**，不能替代完整的沙箱隔离。对于不可信用户，建议使用 Docker 容器隔离方案。

上述正则表达式扫描存在以下已知局限性：

| 局限性 | 说明 | 影响 | 缓解措施 |
|--------|------|------|----------|
| URL 目标无法检测 | 如 `url = "https://evil.com"; requests.get(url)` | 仅检测方法调用，无法确认实际请求目标 | 人工审查代码中 URL 变量来源 |
| 字典参数无法检测 | 如 `subprocess.run(**{"shell": True})` | shell=True 通过字典解包传递时无法捕获 | 属于残余风险，接受 |
| 动态路径无法检测 | 如 `os.listdir(base_path + "/proc")` | 路径通过拼接/变量传递时无法捕获 | 属于残余风险，接受 |
| 混淆代码无法检测 | 如 `eval("os.system")` 通过字符串拼接 | 动态构造的调用无法捕获 | 属于残余风险，接受 |

**设计决策**：正则扫描作为第一道防线，能捕获大部分明显风险。残余风险通过以下方式接受：
- 用户信任模型：内部可信用户，恶意攻击概率低
- 审计追溯：所有执行记录审计日志，可追溯异常行为
- 运行时隔离：即使绕过扫描，环境变量清理和 PATH 限制提供第二层防护

#### 扫描实现

```python
def scan_script_content(content: str) -> list[dict]:
    """
    扫描脚本内容，检测风险模式

    Args:
        content: 脚本文件内容

    Returns:
        检测到的风险列表
    """
    risks = []

    for risk_pattern in RISK_PATTERNS:
        matches = re.findall(risk_pattern.pattern, content)
        if matches:
            risks.append({
                "pattern": risk_pattern.pattern,
                "description": risk_pattern.description,
                "level": risk_pattern.level.value,
                "count": len(matches),
                "positions": [
                    m.start() for m in re.finditer(risk_pattern.pattern, content)
                ],
            })

    return risks


def validate_script_security(content: str) -> tuple[bool, list[dict]]:
    """
    验证脚本安全性

    Returns:
        (是否通过, 风险列表)
    """
    risks = scan_script_content(content)

    # HIGH 级别风险：拒绝上传
    high_risks = [r for r in risks if r["level"] == "high"]

    if high_risks:
        return False, risks

    # MEDIUM 级别风险：需要用户确认
    # LOW 级别风险：仅提示
    return True, risks
```

#### 上传流程集成

```python
async def upload_skill_zip(user: User, content: bytes, metadata: dict):
    # ... 解压 ZIP 文件 ...

    # 扫描所有脚本文件
    scripts_dir = temp_dir / "scripts"
    all_risks = []

    for script_file in scripts_dir.glob("**/*.py"):
        content = script_file.read_text()
        is_safe, risks = validate_script_security(content)

        if not is_safe:
            # 拒绝上传
            raise ScriptSecurityError(
                message="Script contains high-risk patterns",
                risks=risks,
                file=str(script_file.relative_to(scripts_dir)),
            )

        all_risks.extend(risks)

    # MEDIUM 级别风险：返回给前端确认
    medium_risks = [r for r in all_risks if r["level"] == "medium"]
    if medium_risks:
        # 返回需要确认的风险
        return {
            "status": "security_review",
            "risks": all_risks,
            "require_confirmation": True,
        }

    # LOW 级别风险：仅记录日志，继续上传
    if all_risks:
        logger.info(f"Script has low-risk patterns: {all_risks}")

    # 继续正常上传流程 ...
```

#### 前端交互

```
检测到 MEDIUM 级别风险
       │
       ▼
┌─────────────────────────────────────────────────┐
│ 安全审查提示                                     │
│                                                  │
│ ⚠️ 检测到以下潜在风险操作：                       │
│                                                  │
│ • subprocess.run() - 子进程调用                  │
│   文件: scripts/main.py (第 15 行)               │
│                                                  │
│ • requests.get() - HTTP 网络请求                 │
│   文件: scripts/helper.py (第 8 行)              │
│                                                  │
│ 这些操作可能涉及系统资源或外部网络，               │
│ 请确认脚本用途后决定是否继续上传。                │
│                                                  │
│ [了解风险并继续上传]  [取消上传]                  │
│                                                  │
└─────────────────────────────────────────────────┘

检测到 HIGH 级别风险
       │
       ▼
┌─────────────────────────────────────────────────┐
│ 安全审查拒绝                                     │
│                                                  │
│ ❌ 检测到高风险操作，禁止上传：                    │
│                                                  │
│ • os.system() - 执行系统命令                     │
│   文件: scripts/main.py (第 23 行)               │
│                                                  │
│ • eval() - 动态代码执行                          │
│   文件: scripts/main.py (第 45 行)               │
│                                                  │
│ 这些操作存在安全风险，不允许上传。                 │
│ 如需执行此类操作，请联系管理员申请特殊权限。       │
│                                                  │
│ [返回修改]                                       │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 敏感域名检测（可选配置）

```python
# 敏感域名列表（可在配置文件中定义）
SENSITIVE_DOMAINS = [
    "internal.company.com",
    "admin.local",
    # 可扩展
]

# 生成检测正则
def build_sensitive_domain_pattern(domains: list[str]) -> str:
    """构建敏感域名检测正则"""
    escaped = [re.escape(d) for d in domains]
    # 使用非捕获组 (?:...) 进行域名匹配，而非字符类 [...]
    return r"(?:https?://)?(?:" + "|".join(escaped) + r")"

# 使用示例
if SENSITIVE_DOMAINS:
    pattern = build_sensitive_domain_pattern(SENSITIVE_DOMAINS)
    RISK_PATTERNS.append(
        RiskPattern(pattern, "访问敏感域名", RiskLevel.HIGH)
    )
```

### 4. 资源隔离

- 每个用户的虚拟环境完全独立
- 执行时使用 `subprocess` 隔离进程
- 配置资源配额限制

### 5. 依赖安全

- 仅允许安装 PyPI 官方源的包
- 可配置私有镜像源
- 记录所有安装操作审计日志

### 6. 权限控制

- 只有 skill 所有者可以触发环境创建
- 管理员可以查看和清理任意用户环境
- 环境操作记录审计日志


---

**导航**： [← 实施计划](./11-implementation-plan.md) | [返回目录](./00-index.md) | [监控指标 →](./13-monitoring.md)