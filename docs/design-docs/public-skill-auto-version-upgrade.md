# 公共 Skill 自动检测变化并升级版本

## 这份文档解决什么问题

当前 `sync_public_skills.py` 脚本只检查 `_versions` 目录下是否有新的版本子目录。如果版本目录已存在于数据库，则跳过。

当用户更新了 skill 根目录下的文件（如 `SKILL.md`、`references/` 等），脚本只会更新描述信息，不会自动创建新版本。

本文档描述如何增加文件比对逻辑，让 sync 脚本能够：
- 检测 skill 根目录文件与 `_versions` 下最新版本子目录之间的差异
- 当发现变化时，自动在 `_versions` 下生成新版本子目录
- 将新版本注册到数据库

## 先看怎么用

用法不变，但行为增强：

```bash
uv run python backend/scripts/sync_public_skills.py vibe-coding-launcher
```

现在如果 `vibe-coding-launcher` 根目录的文件与 `_versions/1.0.2` 有差异，脚本会自动：
1. 在 `_versions` 下创建 `1.0.3/` 子目录
2. 将根目录文件复制到 `1.0.3/`
3. 注册新版本到数据库
4. 更新 `current_version` 为 `1.0.3`

如果文件没有变化，则只更新描述信息，不创建新版本。

## 行为规则

### 核心流程

```
_versions 目录是否存在？
├── 不存在 → 创建初始版本（1.0.0），复制根目录文件，注册到数据库
└── 存在 → 继续下面流程
        │
        ├── 步骤1：注册未入库的版本子目录
        │   遍历 _versions 下所有子目录，将未注册到数据库的版本补录进去
        │
        ├── 步骤2：找到最新版本子目录
        │   取版本号最高的子目录作为"当前最新版本"
        │
        └── 步骤3：比对根目录与最新版本子目录
                ├── 有变化 → 创建新版本子目录，复制文件，注册到数据库
                └── 无变化 → 跳过，不创建新版本
```

### 比对逻辑

- 收集 skill 根目录下所有文件（排除 `_versions` 目录）
- 收集当前最新版本子目录下所有文件
- 对比文件集合和每个文件的内容哈希（SHA-256）

**视为有变化的条件**（任一满足即触发升级）：
- 文件列表不同（新增/删除文件）
- 同名文件的内容哈希不同

### 版本号自动递增

使用现有的 `next_version` 函数，默认策略为 `patch`：
- `1.0.2` → `1.0.3`
- `1.2.0` → `1.2.1`

### 文件复制策略

当检测到变化时：
- 创建新的版本目录 `_versions/<new_version>/`
- 将根目录下所有文件（排除 `_versions`）复制到新版本目录
- 保持目录结构不变

### 向后兼容

- `_versions` 目录优先：如果用户手动创建了新版本子目录，脚本优先注册手动版本
- 如果根目录文件与当前最新版本完全一致，不创建新版本
- 如果 `_versions` 目录不存在，直接创建并生成初始版本
- 如果 `_versions` 目录存在但没有版本子目录，按没有可用版本处理，创建初始版本快照

## 实现要点

### 文件收集函数

```python
def _collect_files(base_dir: Path, exclude: set[str] | None = None) -> dict[str, str]:
    """收集目录下所有文件的相对路径和内容哈希"""
    exclude = exclude or set()
    result = {}
    for item in base_dir.rglob("*"):
        if not item.is_file():
            continue
        rel = str(item.relative_to(base_dir)).replace("\\", "/")
        if any(rel.startswith(ex) or f"/{ex}/" in rel for ex in exclude):
            continue
        result[rel] = hashlib.sha256(item.read_bytes()).hexdigest()
    return result
```

### 变化检测函数

```python
def _has_changes(skill_dir: Path, version_dir: Path | None) -> bool:
    """检测 skill 根目录文件与指定版本目录是否有差异"""
    if version_dir is None or not version_dir.exists():
        return True
    
    root_files = _collect_files(skill_dir, exclude={"_versions"})
    version_files = _collect_files(version_dir)
    
    if set(root_files.keys()) != set(version_files.keys()):
        return True
    
    for rel_path, root_hash in root_files.items():
        if version_files[rel_path] != root_hash:
            return True
    
    return False
```

### 集成到 sync 流程

在 `_sync_skill_dir` 中的完整流程：

```python
versions_dir = skill_dir / "_versions"
available_versions: list[str] = []

if versions_dir.exists():
    # 步骤1：注册所有已存在的版本子目录
    for version_dir in sorted(versions_dir.iterdir()):
        if not version_dir.is_dir():
            continue
        available_versions.append(version_dir.name)
        if not await version_repo.get_by_version(existing.id, version_dir.name):
            await version_repo.create_version(...)
    
    # 步骤2：找到最新版本子目录
    current_version = max(available_versions, key=lambda v: parse_semver(v) or ("", 0, 0, 0))
    current_version_dir = versions_dir / current_version
    
    # 步骤3：比对根目录与最新版本，如有变化则创建新版本
    if _has_changes(skill_dir, current_version_dir):
        new_version = await next_version(existing, version_repo, strategy="patch")
        version_dir = versions_dir / new_version
        version_dir.mkdir(parents=True, exist_ok=True)
        # 复制根目录文件到新版本目录（排除 _versions）
        for item in skill_dir.iterdir():
            if item.name == "_versions":
                continue
            if item.is_dir():
                shutil.copytree(item, version_dir / item.name, dirs_exist_ok=True)
            else:
                shutil.copy2(item, version_dir / item.name)
        available_versions.append(new_version)
        await version_repo.create_version(...)
else:
    # _versions 目录不存在，创建初始版本
    new_version = "1.0.0" if not db_versions else await next_version(...)
    versions_dir.mkdir(parents=True, exist_ok=True)
    version_dir = versions_dir / new_version
    # 复制文件...
    available_versions.append(new_version)
    await version_repo.create_version(...)

# 更新 current_version
current_version = max(available_versions, key=lambda v: parse_semver(v) or ("", 0, 0, 0))
await skill_repo.update(existing, current_version=current_version, ...)
```

## 错误处理原则

- 文件收集时跳过无法读取的文件，记录警告
- 哈希计算失败时视为有变化（保守策略）
- 版本创建失败时直接报错，不静默跳过

## 不做什么

- 不替代手动创建版本目录的方式
- 不改变版本号语义（用户仍可在 `_versions` 下手动创建任意版本号）
- 不执行文件差异对比展示（只判断是否有变化，不展示具体差异）
- 不影响已有的全量同步和单项导入模式

## 稳定约定

- 变化检测基于内容哈希（SHA-256），不依赖文件修改时间
- 新版本总是基于当前最新版本递增 patch 版本号
- 根目录文件总是被复制到新版本目录，保持完整快照语义
- `_versions` 目录优先：如果用户手动创建了新版本子目录，脚本优先使用手动版本

## 什么时候需要回来看这份文档

如果以后要改变化检测逻辑，优先检查：
- 哈希算法是否需要更换
- 是否需要支持部分文件忽略（如 `.gitignore` 语义）
- 版本号递增策略是否需要 configurable
- 是否需要支持 dry-run 模式预览变化
