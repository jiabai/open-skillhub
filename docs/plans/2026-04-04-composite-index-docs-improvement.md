# 复合索引文档改进计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `03-data-model.md` 索引设计部分从"代码清单 + 单行注释"升级为"设计决策文档"，使读者理解每个索引存在的原因、列顺序依据和关联查询场景。

**Architecture:** 仅修改文档文件 `03-data-model.md` 第 210-235 行区域。将现有的代码块 + 单行注释替换为结构化的表格 + 设计说明，不涉及代码或数据库变更。

**Tech Stack:** Markdown

---

## 问题分析

当前索引设计部分存在 5 个问题：

| # | 问题 | 严重度 | 影响 |
|---|------|--------|------|
| 1 | 复合索引列顺序设计依据缺失 | Important | 读者无法理解为什么是 `(user_id, is_auto, created_at)` 这个顺序 |
| 2 | 索引冗余未标注 | Important | `DependencySnapshot.user_id` 有两个重复索引（外键自动索引 + 手动定义），读者不知道复合索引的最左前缀已覆盖 |
| 3 | 索引与查询场景未关联 | Important | 读者无法理解"哪个 API/内部函数会命中这个索引" |
| 4 | UniqueConstraint vs Index 概念未区分 | Minor | 读者不清楚唯一约束和普通索引的区别 |
| 5 | 部分索引缺少用途注释 | Minor | `ix_users_runtime_locked`、`ix_users_venv_last_used_at` 等无注释 |

---

## Task 1: 重写索引设计部分

**Files:**
- Modify: `docs/user-runtime-environment/03-data-model.md:210-235`

**Step 1: 替换索引设计部分**

将第 210-235 行替换为以下内容（保留代码块但补充结构化说明）：

```markdown
### 索引设计

#### 设计原则

| 原则 | 说明 |
|------|------|
| 最左前缀 | 复合索引的列顺序按"等值条件（高区分度）→ 等值条件（低区分度）→ 排序/范围条件"排列，确保查询能利用索引的最左前缀 |
| 避免冗余 | 复合索引的最左前缀已覆盖的单列查询，不再创建重复单列索引 |
| 注释完整 | 每个索引必须标注用途（支撑的查询场景） |

#### 各模型索引

```python
# ── User 模型索引 ──
# 查找被锁定的用户（后台巡检、请求入口检查）
Index('ix_users_runtime_locked', runtime_locked)
# 空闲环境清理定时任务：WHERE venv_last_used_at < {threshold}
Index('ix_users_venv_last_used_at', venv_last_used_at)

# ── Skill 模型索引 ──
# 按用户查询 Skill 列表（已由初始迁移 b1a2c3d4 创建）
Index('ix_skills_user_id', user_id)
# 查询特定部署状态的 Skill，如 WHERE install_status = 'failed'
Index('ix_skills_install_status', install_status)

# ── SkillVersion 模型索引 ──
# 按 Skill 查询所有版本（如版本列表 API）
Index('ix_skill_versions_skill_id', skill_id)
# ⚠️ 此索引使用频率较低，仅用于按版本号精确查找场景。
#   日常查询主要走 uix_skill_versions 唯一约束（见下方唯一约束设计）。
Index('ix_skill_versions_version', version)
```

#### 复合索引

DependencySnapshot 模型使用一个 3 列复合索引：

```python
# ── DependencySnapshot 模型 ──
# 列顺序设计依据：
#   1. user_id（等值条件，区分度高）→ 过滤到特定用户
#   2. is_auto（等值条件，布尔值，区分度低）→ 区分自动/手动快照
#   3. created_at DESC（排序条件）→ 按时间降序，避免文件排序
#
# 最左前缀覆盖：
#   (user_id) → 按 user_id 查询（如快照列表 API）
#   (user_id, is_auto) → 按 user_id + is_auto 查询（如清理逻辑）
#   (user_id, is_auto, created_at DESC) → 完整匹配（如清理时取最早的快照）
#
# ⚠️ 第 186 行 ForeignKey 上的 index=True 会自动创建单列索引 ix_dependency_snapshots_user_id，
#   与复合索引的最左前缀 (user_id) 功能重复。建议移除外键上的 index=True，
#   由复合索引的最左前缀覆盖即可。如保留，应在迁移中明确说明原因。
Index('ix_dependency_snapshots_user_is_auto_created_at', user_id, is_auto, created_at.desc())
```

> **注意**：由于复合索引 `(user_id, is_auto, created_at.desc())` 的最左前缀已覆盖 `user_id` 单列查询，原设计中第 226 行的 `Index('ix_dependency_snapshots_user_id', user_id)` 是冗余的，应移除。同时第 186 行外键上的 `index=True` 也与之重复，建议一并清理。

#### 关联查询场景

| 索引 | 命中的查询/场景 | 文档引用 |
|------|-----------------|---------|
| `ix_dependency_snapshots_user_is_auto_created_at` | `cleanup_dependency_snapshots()` 中 `list_by_user(user_id, is_auto=True, order_by_desc="created_at")` | [环境清理策略](./09-cleanup-strategy.md) |
| `ix_dependency_snapshots_user_is_auto_created_at`（最左前缀） | `GET /api/v1/runtime/dependency-snapshots` 快照列表查询 | [API 设计 - 查询快照列表](./06-api-design.md) |
| `ix_users_runtime_locked` | 请求入口检查 `runtime_locked = True`、后台巡检 | [并发安全机制](./05-concurrency.md) |
| `ix_users_venv_last_used_at` | 空闲环境清理定时任务 `WHERE venv_last_used_at < threshold` | [环境清理策略](./09-cleanup-strategy.md) |
| `ix_skills_install_status` | 查询未部署/部署失败的 Skill | [API 设计](./06-api-design.md) |

### 唯一约束设计

> **概念说明**：`UniqueConstraint` 和 `Index` 是 SQLAlchemy 中两种不同的索引声明方式。`UniqueConstraint` 创建唯一索引，既保证数据唯一性也提供查询加速；普通 `Index` 仅加速查询，不约束数据唯一性。`UniqueConstraint` 会隐式创建一个唯一索引，因此如果已有唯一约束覆盖的列组合，通常不需要再创建重复的普通索引。

```python
# SkillVersion 模型：同一 Skill 不能有重复版本号
# 隐式创建唯一索引，同时支撑 (skill_id, version) 的联合查询
UniqueConstraint('skill_id', 'version', name='uix_skill_versions')
```

> **说明**：`uix_skill_versions` 唯一约束同时作为复合唯一索引使用，支撑"查询某 Skill 的特定版本"场景。因此 `ix_skill_versions_skill_id` 单列索引在"按 skill_id 查询所有版本"场景下仍有独立价值（因为唯一索引的查询条件通常包含 `version`），两者不冗余。
```

**Step 2: 验证 Markdown 语法**

检查替换后的文档中所有表格、代码块、链接是否正确渲染。

**Step 3: Commit**

```bash
git add docs/user-runtime-environment/03-data-model.md
git commit -m "docs: improve composite index documentation with design rationale"
```

---

## 改进前后对比

| 维度 | 改进前 | 改进后 |
|------|--------|--------|
| 复合索引说明 | 1 行注释 | 列顺序依据 + 最左前缀覆盖 + 冗余标注 |
| 索引用途 | 仅 1 个有注释 | 全部 8 个索引均有注释 |
| 查询场景 | 无 | 表格关联 API 和内部函数 |
| 概念区分 | 无 | UniqueConstraint vs Index 说明 |
| 冗余索引 | 未标注 | 明确标注并给出清理建议 |
