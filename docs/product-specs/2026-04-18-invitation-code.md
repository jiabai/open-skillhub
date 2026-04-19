# 邀请码注册与管理后台设计规格

## Context

当前系统支持邮箱验证码注册，需要新增邀请码功能来限制公开注册。同时新建管理后台供管理员（is_superuser）创建和管理邀请码。

**约束条件**：
- 不开启 RBAC，使用 `is_superuser` 字段识别管理员
- 用户注册必须使用邮箱 + 邀请码
- 邀请码可重复使用，有使用次数上限
- 仅管理员可创建邀请码
- 需记录用户使用了哪个邀请码

---

## 1. 数据模型

### 新增 `invitation_codes` 表

文件：`backend/models/invitation_code.py`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| code | String(16) | UNIQUE, NOT NULL | 邀请码（格式：8位字母数字，不含易混淆字符） |
| name | String(100) | NOT NULL | 邀请码名称（管理员标识用途） |
| max_uses | Integer | DEFAULT 100 | 最大使用次数 |
| used_count | Integer | DEFAULT 0 | 已使用次数 |
| is_active | Boolean | DEFAULT True | 是否启用 |
| expires_at | DateTime | NULLABLE | 过期时间（可选） |
| created_by | UUID | FK → users.id | 创建者（管理员） |
| created_at | DateTime | | 时间戳（继承 TimestampMixin） |
| updated_at | DateTime | | 时间戳（继承 TimestampMixin） |

索引：`code`（唯一）、`is_active`、`expires_at`

### 邀请码生成规则

自动生成邀请码时遵循以下规则：
- **长度**：8 位字符
- **字符集**：大写字母 + 数字，排除易混淆字符（0、O、1、I、L）
- **可用字符**：`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- **格式**：不分段，整体显示（如 `ABCD2345`）
- **碰撞处理**：若生成已存在的邀请码，重新生成最多 10 次，失败则返回错误

### 修改 `users` 表

文件：`backend/models/user.py`

新增字段：`invitation_code_id: UUID | None`（可选，FK → invitation_codes.id）

---

## 1.1 并发控制策略

使用邀请码注册时，采用**乐观锁**策略防止 `used_count` 超过 `max_uses`：

```python
# 伪代码
invitation_code = await repo.get_by_code(code)
if invitation_code.used_count >= invitation_code.max_uses:
    raise ValueError("邀请码已用尽")

# 更新时检查版本未变化
result = await session.execute(
    update(InvitationCode)
    .where(InvitationCode.id == invitation_code.id)
    .where(InvitationCode.used_count == invitation_code.used_count)  # 版本检查
    .values(used_count=invitation_code.used_count + 1)
)
if result.rowcount == 0:
    raise ValueError("邀请码已被其他用户使用")
```

**备选方案**：若并发压力高，可改用 `SELECT FOR UPDATE` 悲观锁，但当前场景建议乐观锁。

---

## 1.2 功能配置项

通过环境变量配置邀请码功能：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ENABLE_INVITATION_CODE` | Boolean | `false` | 是否启用邀请码注册（启用后注册必须提供邀请码） |
| `INVITATION_CODE_DEFAULT_MAX_USES` | Integer | `100` | 创建邀请码时的默认使用次数上限 |
| `INVITATION_CODE_DEFAULT_EXPIRES_DAYS` | Integer | `30` | 创建邀请码时的默认有效天数（0 表示永不过期） |
| `INVITATION_CODE_LENGTH` | Integer | `8` | 自动生成邀请码的长度 |
| `INVITATION_CODE_RATE_LIMIT` | Integer | `10` | 验证邀请码的速率限制（每分钟最多尝试次数） |

---

## 2. API 设计

### 2.1 管理员 API（需要 is_superuser=True）

**路由文件**：`backend/api/v1/admin_invitation_codes.py`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/admin/invitation-codes` | POST | 创建邀请码 |
| `/api/v1/admin/invitation-codes` | GET | 列出邀请码（分页、筛选：is_active、used_status、expired_status） |
| `/api/v1/admin/invitation-codes/{id}` | GET | 获取详情（含使用用户列表） |
| `/api/v1/admin/invitation-codes/{id}` | PUT | 更新（name、max_uses、is_active、expires_at） |
| `/api/v1/admin/invitation-codes/{id}` | DELETE | 删除邀请码（未使用的可删除，已使用的返回 400 并提示"可禁用"） |

**筛选参数说明**：
- `is_active`：`true`（启用）/ `false`（禁用）
- `used_status`：`unused`（未使用）/ `partial`（部分使用）/ `exhausted`（已用尽）
- `expired_status`：`valid`（未过期）/ `expired`（已过期）

**请求/响应示例**：

创建邀请码：
```json
POST /api/v1/admin/invitation-codes
{
  "code": "INVITE2024A",  // 可选，不提供则自动生成
  "name": "内部测试邀请码",
  "max_uses": 50,
  "expires_at": "2024-12-31T23:59:59Z"  // 可选
}

Response:
{
  "id": "uuid",
  "code": "INVITE2024A",
  "name": "内部测试邀请码",
  "max_uses": 50,
  "used_count": 0,
  "is_active": true,
  "expires_at": "...",
  "created_by": "admin_uuid",
  "created_at": "..."
}
```

### 2.2 公开 API

**验证邀请码有效性**：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/invitation-codes/validate` | POST | 验证邀请码是否可用 |

```json
POST /api/v1/invitation-codes/validate
{
  "code": "INVITE2024A"
}

Response (成功):
{
  "valid": true,
  "code": null
}

Response (失败):
{
  "valid": false,
  "reason": "邀请码已用尽",
  "code": "invitation_code.used_up"
}
```

### 2.3 注册流程修改

**修改文件**：`backend/api/v1/auth.py`、`backend/services/auth_service.py`

注册流程变更：
1. 用户输入邮箱、用户名、邀请码
2. **点击"发送验证码"时**，前端先调用 `/api/v1/invitation-codes/validate` 验证邀请码
3. 验证码发送请求中，后端再次验证邀请码（防止绕过前端验证）
4. 用户输入邮箱验证码，提交注册
5. 后端验证邮箱验证码 + 验证邀请码（乐观锁控制并发）
6. 创建用户，设置 `invitation_code_id`
7. 递增邀请码 `used_count`
8. 返回 JWT Token

---

## 3. 服务层

### 新增 `InvitationCodeService`

文件：`backend/services/invitation_code_service.py`

核心方法：
- `create(code, name, max_uses, expires_at, created_by)` - 创建邀请码
- `validate(code)` - 验证邀请码有效性，返回 (valid, invitation_code_or_reason)
- `use(code)` - 递增 used_count（事务内调用）
- `list(filters, pagination)` - 列表查询
- `get(id)` - 获取详情
- `update(id, fields)` - 更新
- `delete(id)` - 删除（检查 used_count == 0）

### 新增 `InvitationCodeRepository`

文件：`backend/repositories/invitation_code_repository.py`

数据访问方法：
- `get_by_code(code)` - 按邀请码查询
- `get_by_id(id)` - 按 ID 查询
- `create(invitation_code)` - 创建
- `update(invitation_code)` - 更新
- `delete(id)` - 删除
- `list(filters)` - 列表

---

## 3.1 审计日志

邀请码相关操作需记录审计日志（若 `ENABLE_AUDIT_LOG=true`）：

| 操作 | actor_id | action | target | metadata |
|------|----------|--------|--------|----------|
| 创建邀请码 | 管理员 ID | `invitation_code.create` | 邀请码 ID | `{name, max_uses, expires_at}` |
| 更新邀请码 | 管理员 ID | `invitation_code.update` | 邀请码 ID | `{变更字段}` |
| 删除邀请码 | 管理员 ID | `invitation_code.delete` | 邀请码 ID | `{name}` |
| 禁用邀请码 | 管理员 ID | `invitation_code.disable` | 邀请码 ID | `{reason}` |
| 使用邀请码注册 | 新用户 ID | `auth.register` | 新用户 ID | `{invitation_code_id}` |

---

## 3.2 国际化错误消息

邀请码验证失败的错误消息需支持多语言：

| 错误码 | 中文 | 英文 |
|--------|------|------|
| `invitation_code.not_found` | 邀请码不存在 | Invitation code not found |
| `invitation_code.expired` | 邀请码已过期 | Invitation code expired |
| `invitation_code.used_up` | 邀请码已用尽 | Invitation code exhausted |
| `invitation_code.disabled` | 邀请码已禁用 | Invitation code disabled |
| `invitation_code.concurrent_use` | 邀请码已被使用 | Invitation code already used |

前端错误提示通过 `code` 字段匹配国际化文案，后端返回格式：
```json
{
  "valid": false,
  "reason": "邀请码已用尽",
  "code": "invitation_code.used_up"
}
```

---

## 4. 前端设计

### 4.1 注册页面修改

**修改文件**：`frontend/src/app/register/page.tsx`

新增：
- 邀请码输入框（必填）
- 前端调用 `/api/v1/invitation-codes/validate` 验证邀请码
- 错误提示：显示具体原因（不存在、已过期、已用尽、已禁用）

### 4.2 管理后台（新建）

**新建目录**：`frontend/src/app/admin/`

| 文件 | 功能 |
|------|------|
| `layout.tsx` | 管理后台布局，检查 is_superuser |
| `page.tsx` | 管理后台首页（统计概览） |

**首页统计内容**：
- 邀请码总数
- 活跃邀请码数（`is_active=true` 且未过期）
- 已用尽邀请码数（`used_count >= max_uses`）
- 本周新增用户数（通过邀请码注册）
- 本月新增用户数（通过邀请码注册）
- 最近 5 个邀请码（按创建时间降序）

| 文件 | 功能 |
|------|------|
| `invitation-codes/page.tsx` | 邀请码列表页 |
| `invitation-codes/[id]/page.tsx` | 邀请码详情页 |
| `invitation-codes/create/page.tsx` | 创建邀请码页（或用对话框） |

**新建组件**：`frontend/src/components/admin/`

| 文件 | 功能 |
|------|------|
| `InvitationCodeList.tsx` | 邀请码列表组件 |
| `InvitationCodeForm.tsx` | 创建/编辑邀请码表单 |
| `InvitationCodeDetail.tsx` | 邀请码详情（含使用用户列表） |
| `AdminSidebar.tsx` | 管理后台侧边栏导航 |

**管理后台路由守卫**：
```typescript
// layout.tsx 中检查
if (!user || !user.is_superuser) {
  redirect('/');
}
```

---

## 5. 数据库迁移

**迁移文件**：`backend/db/migrations/versions/xxx_add_invitation_codes.py`

操作：
1. 创建 `invitation_codes` 表
2. 为 `users` 表添加 `invitation_code_id` 字段（可选 FK）

---

## 6. 安全考虑

- 邀请码不存储敏感信息，但应防止暴力枚举（速率限制）
- 管理员 API 必须验证 `is_superuser=True`
- 验证邀请码和创建用户应在同一事务内，防止并发问题导致 used_count 超过 max_uses

---

## 7. 验证方式

实现完成后验证：

1. **数据库**：运行迁移，检查表结构
2. **API 测试**：
   - 管理员创建邀请码
   - 公开验证邀请码 API
   - 使用邀请码注册用户
   - 管理员查看邀请码使用列表
3. **前端测试**：
   - 注册页面邀请码验证交互
   - 管理后台邀请码管理流程
4. **单元测试**：InvitationCodeService 和 Repository 测试

---

## 8. 关键文件清单

### 后端新增
- `backend/models/invitation_code.py`
- `backend/repositories/invitation_code_repository.py`
- `backend/services/invitation_code_service.py`
- `backend/api/v1/admin_invitation_codes.py`
- `backend/api/v1/invitation_codes.py`（公开验证 API）
- `backend/schemas/invitation_code.py`（请求/响应 Schema）
- `backend/db/migrations/versions/xxx_add_invitation_codes.py`

### 后端修改
- `backend/models/user.py` - 添加 invitation_code_id 字段
- `backend/api/v1/auth.py` - 注册流程添加邀请码验证
- `backend/services/auth_service.py` - 注册逻辑修改
- `backend/api/v1/__init__.py` - 注册新路由

### 前端新增
- `frontend/src/app/admin/layout.tsx`
- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/admin/invitation-codes/page.tsx`
- `frontend/src/app/admin/invitation-codes/[id]/page.tsx`
- `frontend/src/components/admin/InvitationCodeList.tsx`
- `frontend/src/components/admin/InvitationCodeForm.tsx`
- `frontend/src/components/admin/InvitationCodeDetail.tsx`
- `frontend/src/components/admin/AdminSidebar.tsx`
- `frontend/src/lib/api-admin.ts` - 管理后台 API 调用

### 前端修改
- `frontend/src/app/register/page.tsx` - 添加邀请码输入和验证
- `frontend/src/types/user.ts` - 添加 is_superuser 类型（如未定义）

---

## 9. 实现顺序建议

1. 数据模型 + 迁移
2. Repository + Service
3. 公开验证 API
4. 管理员 API
5. 注册流程修改（后端）
6. 注册页面修改（前端）
7. 管理后台前端
8. 单元测试