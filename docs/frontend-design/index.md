# Open SkillHub 前端构建与设计文档

> 本文档为前端设计文档的**索引入口**，完整内容已拆分为多个独立文档。

---

## 文档拆分说明

为方便与后端代码对照确认接口功能一致性，原文档已拆分为以下独立文档：

| 文档 | 内容范围 | 与后端对照价值 |
|------|----------|---------------|
| [01-api-types.md](./01-api-types.md) | API 类型定义、客户端结构、契约映射 | ⭐⭐⭐ 核心对照 |
| [02-auth-security.md](./02-auth-security.md) | 认证流程、Token 管理、路由保护、RBAC、审计日志 | ⭐⭐⭐ 核心对照 |
| [03-business-exception.md](./03-business-exception.md) | 功能开关、异常处理、状态管理、差异与优先级 | ⭐⭐ 业务流程 |
| [04-basics-readonly.md](./04-basics-readonly.md) | 技术栈、设计系统、组件、页面、开发规范 | ⭐ 与后端无关 |

---

## 文档索引

### 1. API 与数据模型
- [API 客户端结构](./01-api-types.md#1-api-客户端)
- [类型定义](./01-api-types.md#2-类型定义)
- [前后端契约映射](./01-api-types.md#3-前后端契约映射)

### 2. 认证与安全
- [认证流程](./02-auth-security.md#1-认证流程)
- [Token 自动刷新](./02-auth-security.md#2-token-自动刷新)
- [路由保护](./02-auth-security.md#3-路由保护)
- [权限系统](./02-auth-security.md#4-权限系统)
- [审计日志](./02-auth-security.md#5-审计日志)

### 3. 业务逻辑与异常
- [功能开关与条件渲染](./03-business-exception.md#1-功能开关与条件渲染)
- [异常场景处理](./03-business-exception.md#2-异常场景处理)
- [状态管理](./03-business-exception.md#3-状态管理)
- [当前差异与修复优先级](./03-business-exception.md#4-当前差异与修复优先级)

### 4. 技术基础（只读）
- [技术栈概览](./04-basics-readonly.md#1-技术栈概览)
- [设计系统](./04-basics-readonly.md#2-设计系统)
- [组件架构](./04-basics-readonly.md#3-组件架构)
- [页面结构](./04-basics-readonly.md#4-页面结构)
- [开发规范](./04-basics-readonly.md#5-开发规范)
- [部署配置](./04-basics-readonly.md#6-部署配置)

---

## 前后端对照清单

### 1. 数据模型层面
- 字段命名（camelCase vs snake_case）
- 字段类型（TypeScript vs Pydantic）
- 枚举值一致性
- 必填 vs 可选

### 2. API 接口层面
- 接口路径与方法
- 请求参数与响应结构
- 错误码体系

### 3. 业务逻辑层面
- 验证规则
- 状态转换
- 权限规则
- 流程顺序

### 4. 认证与安全层面
- Token 存储与刷新
- 登录方式配置
- 密码策略

### 5. 功能开关层面
- 注册开关 (`ENABLE_PUBLIC_SIGNUP`)
- SSO/LDAP 配置 (`ENABLE_SSO`, `ENABLE_LDAP`)
- 审计日志 (`ENABLE_AUDIT_LOG`)

---

*最后更新：2026-03-20*
