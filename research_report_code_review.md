# Open SkillHub 真实问题清单

## 说明

本清单只保留**按当前仓库代码仍然成立**的问题。

以下内容已经被排除：

- 已修复的问题
- 基于旧代码状态的结论
- 只是设计取舍、但当前实现自洽的问题
- 文档表述问题但不构成真实代码风险的问题

目标是把这份文档变成可执行的真实问题列表，而不是历史审查痕迹。

## 高优先级

### 1. Refresh token 缺少严格的轮换失效机制

**现状**

- `/auth/refresh` 会返回新的 `access_token` 和新的 `refresh_token`
- 前端也会把新的 token pair 整体写回本地存储
- 但当前实现没有看到“旧 refresh token 使用后立即失效”的状态化机制
- 也没有 refresh token reuse detection 或 token family 跟踪

**风险**

- 如果 refresh token 泄露，在其过期前可能被重复使用
- 当前更接近“重新签发 refresh token”，而不是严格意义上的“单次轮换并作废旧 token”

**影响范围**

- 认证安全
- 长会话账号接管风险

**对应代码**

- `backend/api/v1/auth.py`
- `backend/services/auth.py`
- `backend/core/security/jwt_utils.py`
- `frontend/src/lib/api.ts`

---

## 中优先级

### 2. 列表查询与总数统计不是同一数据快照

**现状**

- `list_skills` 先查 `items`，再单独查 `total`
- `list_public_skills` 也是同样模式
- 两次查询之间如果有并发写入，返回结果可能短暂不一致

**风险**

- 用户可能看到 `total` 与当前页项目数不匹配
- 分页 UI 在高并发下可能出现轻微跳动或误差

**影响范围**

- 列表一致性
- 分页体验

**对应代码**

- `backend/api/v1/skills.py`
- `backend/repositories/skill.py`

---

### 3. 下载限流只在单进程内生效，多实例部署可被绕过

**现状**

- 下载限流状态保存在模块级内存字典 `_download_rate_limit_state`
- 配套锁 `_download_rate_limit_lock` 也是进程内锁

**风险**

- 多 worker 或多实例部署下，限流无法全局共享
- 用户可通过命中不同实例绕过限制

**影响范围**

- 下载接口保护
- 资源消耗控制

**对应代码**

- `backend/api/v1/skills_support.py`

---

### 4. 前后端 feature flag 没有自动同步机制

**现状**

- 后端通过 `ENABLE_SKILL_VISIBILITY` 控制真实可见性逻辑
- 前端通过 `NEXT_PUBLIC_ENABLE_SKILL_VISIBILITY` 控制 UI 展示
- 两端都依赖各自环境变量，没有统一下发机制

**风险**

- 配置错配时，前端可能展示后端未启用的功能
- 或后端已启用功能但前端 UI 仍隐藏

**影响范围**

- 功能可见性
- 前后端行为一致性

**对应代码**

- `backend/config/settings.py`
- `backend/repositories/skill.py`
- `frontend/src/lib/feature-flags.ts`

---

### 5. `serialize_skill` 的实现方式可维护性较差

**现状**

- 当前流程是：从 ORM `model_validate`，再 `model_dump`，手动补充字段，再重新 `model_validate`
- 代码可以工作，但路径较绕

**风险**

- 后续新增字段、别名或响应模型调整时，更容易引入遗漏
- 序列化语义分散在 schema 和辅助函数之间，不利于维护

**影响范围**

- 响应模型演进
- 可维护性

**对应代码**

- `backend/api/v1/skills_support.py`

---

## 低优先级 / 需要明确文档边界

### 6. 下载权限在 RBAC 开关不同模式下行为不同

**现状**

- `ENABLE_RBAC=True` 时，下载需要 `skill.download` 权限
- `ENABLE_RBAC=False` 时，用户可以下载自己的 skill

**为什么放在问题清单里**

- 这不是明显 bug
- 但它是一个容易被误解的系统行为边界
- 如果没有文档说明，用户会觉得权限模型前后不一致

**风险**

- 运维或产品侧误判权限设计
- 测试时按单一权限模型写出错误预期

**影响范围**

- 权限理解
- 文档准确性

**对应代码**

- `backend/core/permissions.py`
- `backend/core/deps.py`

---

### 7. Public skill 功能与 RBAC 模式互斥，但边界需要被明确

**现状**

- `public` 可见性在 `ENABLE_RBAC=False` 时才对所有人开放
- `SkillService.public_features_enabled()` 也要求 `ENABLE_SKILL_VISIBILITY and not ENABLE_RBAC`

**为什么放在问题清单里**

- 当前实现本身是自洽的
- 但它体现的是一个较强的产品假设：public skill 面向非 RBAC 场景
- 如果文档没有讲清楚，容易被误解成可见性逻辑异常

**风险**

- 企业模式下误以为 `public` 仍然代表“全局公开”
- 功能验收与实际实现预期不一致

**影响范围**

- 可见性模型理解
- 产品配置策略

**对应代码**

- `backend/core/security/rbac.py`
- `backend/services/skill.py`

---

## 当前不应再视为问题的项目

以下项目在当前代码下**不应继续列为问题**：

- 可见性枚举约束缺失
- `get_public_skill` 无认证
- `visible/visibility` 响应字段别名错误
- clone 请求体字段不一致
- `/skills` 与 `/skills/public` 路由冲突
- `skill_dir` 暴露给前端
- login 绕过 `ENABLE_PUBLIC_SIGNUP`
- `skills.py` 内 JWT / API token 权限依赖混乱

## 建议使用方式

如果后续要继续推进修复，建议按下面顺序处理：

1. 先处理认证安全问题：refresh token 机制
2. 再处理部署可靠性问题：下载限流分布式化
3. 再处理一致性与可维护性问题：list/count 快照、序列化结构
4. 最后补齐文档：RBAC 与 public/download 模式边界

## 一句话总结

当前真正值得跟进的问题不多，核心集中在四类：

- 认证安全还不够严格
- 分布式部署下的限流不完整
- 列表返回存在并发一致性边界
- 部分系统行为依赖文档解释，否则容易被误解
