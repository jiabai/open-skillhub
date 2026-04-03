---
status: draft
ai_read: true
last_updated: 2026-04-03
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

def build_safe_environment(
    user: User,
    skill_path: Path,
    venv_path: Path,
    params: dict,
) -> tuple[dict[str, str], Path]:
    """
    构建安全的执行环境变量

    Args:
        user: 用户对象
        skill_path: Skill 文件路径
        venv_path: 用户虚拟环境路径
        params: Skill 执行参数

    Returns:
        (环境变量字典, 临时目录路径)

    Important:
        调用方负责在脚本执行完成后清理返回的临时目录（temp_dir），
        推荐使用 try/finally 确保清理：
        ```python
        env, temp_dir = build_safe_environment(user, skill_path, venv_path, params)
        try:
            await run_script(...)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
        ```
    """
    if platform.system() == "Windows":
        venv_bin = venv_path / "Scripts"
    else:
        venv_bin = venv_path / "bin"

    import tempfile
    temp_dir = Path(tempfile.gettempdir()) / f"skill_{user.id}_{uuid.uuid4().hex[:8]}"
    temp_dir.mkdir(parents=True, exist_ok=True)

    safe_env = {
        "PATH": str(venv_bin),
        "SKILL_PARAMS": json.dumps(params),
        "PYTHONPATH": str(skill_path),
        "PYTHONIOENCODING": "utf-8",
        "HOME": str(temp_dir),
        "TMPDIR": str(temp_dir),
        "TEMP": str(temp_dir),
        "TMP": str(temp_dir),
        "LANG": "en_US.UTF-8",
        "LC_ALL": "en_US.UTF-8",
    }

    if platform.system() == "Windows":
        safe_env["SystemRoot"] = os.environ.get("SystemRoot", "C:\\Windows")

    return safe_env, temp_dir
```

#### PATH 限制说明

| 限制 | 影响 | 解决方案 |
|------|------|---------|
| 无法调用 `git` | 不能执行 git 命令 | 使用 Python 库如 `pygit2` |
| 无法调用 `curl/wget` | 不能下载外部文件 | 使用 Python 库如 `requests` |
| 无法调用 `ffmpeg` | 不能处理视频/音频 | 打包 ffmpeg 到 Skill 目录 |

### 3. 脚本安全扫描

#### 扫描时机

安全扫描在**上传阶段**执行（不随部署阶段），尽早拦截高风险脚本。

#### 风险模式定义

```python
# backend/services/script_scanner.py

from dataclasses import dataclass

class RiskLevel(Enum):
    LOW = "low"       # 提示但允许
    MEDIUM = "medium" # 需要确认
    HIGH = "high"     # 拒绝上传


@dataclass(frozen=True)
class RiskPattern:
    """风险模式定义"""
    pattern: str          # 正则表达式
    description: str      # 风险描述
    level: RiskLevel      # 风险级别


RISK_PATTERNS: list[RiskPattern] = [
    # HIGH: 拒绝上传
    RiskPattern(r"os\.system\s*\(", "执行系统命令", RiskLevel.HIGH),
    RiskPattern(r"subprocess\.(call|run|Popen)\s*\([^)]*shell\s*=\s*True", "Shell 命令执行", RiskLevel.HIGH),
    RiskPattern(r"eval\s*\(", "动态代码执行", RiskLevel.HIGH),
    RiskPattern(r"exec\s*\(", "动态代码执行", RiskLevel.HIGH),
    RiskPattern(r"__import__\s*\(", "动态模块加载", RiskLevel.HIGH),
    RiskPattern(r"pickle\.loads", "Pickle 反序列化", RiskLevel.HIGH),
    RiskPattern(r"open\s*\(\s*[\'\"]\/etc\/", "读取系统配置文件", RiskLevel.HIGH),
    RiskPattern(r"open\s*\(\s*[\'\"]\/var\/log\/", "读取系统日志", RiskLevel.HIGH),
    RiskPattern(r"open\s*\(\s*[\'\"]\/proc\/", "读取进程信息", RiskLevel.HIGH),
    RiskPattern(r"os\.environ(\s*\[|\.(get|pop|setdefault|update)\s*\()", "读取/操作环境变量", RiskLevel.HIGH),
    RiskPattern(r"winreg\.", "Windows 注册表操作", RiskLevel.HIGH),
    RiskPattern(r"yaml\.load\s*\([^)]*,\s*Loader\s*=\s*None", "不安全的 YAML 加载", RiskLevel.HIGH),

    # MEDIUM: 需要确认
    RiskPattern(r"subprocess\.(call|run|Popen)\s*\(", "子进程调用", RiskLevel.MEDIUM),
    RiskPattern(r"socket\.", "网络 Socket 操作", RiskLevel.MEDIUM),
    RiskPattern(r"requests\.(get|post|put|delete|patch)\s*\(", "HTTP 请求", RiskLevel.MEDIUM),
    RiskPattern(r"aiohttp\.(get|post|put|delete|patch)\s*\(", "异步 HTTP 请求", RiskLevel.MEDIUM),
    RiskPattern(r"import\s+ctypes", "导入 ctypes", RiskLevel.MEDIUM),
    RiskPattern(r"importlib\.import_module", "动态模块加载", RiskLevel.MEDIUM),

    # LOW: 提示但允许
    RiskPattern(r"open\s*\(", "文件操作", RiskLevel.LOW),
    RiskPattern(r"os\.path\.", "路径操作", RiskLevel.LOW),
    RiskPattern(r"shutil\.", "文件系统操作", RiskLevel.LOW),
]
```

#### 扫描局限性

| 局限性 | 说明 | 缓解措施 |
|--------|------|----------|
| URL 目标无法检测 | 如 `url = "https://evil.com"; requests.get(url)` | 属于残余风险，接受 |
| 动态路径无法检测 | 如 `os.listdir(base_path + "/proc")` | 属于残余风险，接受 |
| 混淆代码无法检测 | 如 `eval("os.system")` 通过字符串拼接 | 属于残余风险，接受 |

### 4. 部署阶段安全

> **新增**：部署阶段的安全策略。

#### 依赖安装安全

| 安全措施 | 说明 |
|----------|------|
| 仅允许 PyPI 官方源 | 可配置私有镜像源 |
| 安装超时 | 防止网络问题导致无限等待 |
| 快照恢复 | 安装失败可从快照恢复 |
| 安装日志记录 | 所有安装操作记录审计日志 |

#### 部署权限控制

- 只有 Skill 所有者可以触发部署
- 管理员可以查看和清理任意用户环境
- 部署操作记录审计日志

### 5. 资源隔离

- 每个用户的虚拟环境完全独立
- 执行时使用 `subprocess` 隔离进程
- 配置资源配额限制

### 6. 权限控制

- 只有 Skill 所有者可以上传、部署、执行、删除
- 管理员可以查看和清理任意用户环境
- 环境操作记录审计日志


---

**导航**： [← 实施计划](./11-implementation-plan.md) | [返回目录](./00-index.md) | [监控指标 →](./13-monitoring.md)
