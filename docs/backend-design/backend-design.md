# Open SkillHub 后端设计与开发文档 — 架构设计

> 本文档为后端设计文档的**索引入口**，完整内容已拆分为多个独立文档。

---

## 文档拆分说明

为方便与前端代码对照确认接口功能一致性，原文档已拆分为以下独立文档：

| 文档 | 内容范围 | 与前端对照价值 |
|------|----------|---------------|
| [backend-design-01-architecture.md](./backend-design-01-architecture.md) | 系统架构、运行模式、模块依赖、部署模型 | ⭐⭐⭐ 架构对照 |
| [backend-design-02-api-routes.md](./backend-design-02-api-routes.md) | REST API v1 路由、MCP 端点、SSE/STDIO 传输层、路由权限矩阵 | ⭐⭐⭐ 核心对照 |
| [backend-design-03-data-models.md](./backend-design-03-data-models.md) | 数据模型设计、数据库 Schema、ER 关系、版本策略 | ⭐⭐⭐ 核心对照 |
| [backend-design-04-security.md](./backend-design-04-security.md) | 认证流程、JWT/Token 机制、RBAC 权限模型、审计日志 | ⭐⭐⭐ 核心对照 |
| [backend-design-05-mcp-tools.md](./backend-design-05-mcp-tools.md) | MCP 工具定义、Skill 生命周期管理、Shell 命令白名单、资源隔离 | ⭐⭐⭐ 核心对照 |
| [backend-design-06-services.md](./backend-design-06-services.md) | 业务服务层设计、Email/通知、缓存策略、配置管理 | ⭐⭐ 业务流程 |
| [backend-design-07-deployment-ops.md](./backend-design-07-deployment-ops.md) | 环境配置、Docker 部署、运维工具、日志规范 | ⭐ 与前端无关 |

---

## 文档索引

### 1. 架构与部署
- [系统架构与运行模式](./backend-design-01-architecture.md#1-系统架构)
- [模块依赖关系](./backend-design-01-architecture.md#2-模块依赖)
- [两种运行模式对比](./backend-design-01-architecture.md#3-运行模式)

### 2. API 与路由
- [REST API v1 路由](./backend-design-02-api-routes.md#1-rest-api-v1)
- [MCP 端点与传输层](./backend-design-02-api-routes.md#2-mcp-端点)
- [路由权限矩阵](./backend-design-02-api-routes.md#3-路由权限矩阵)
- [全局中间件与特殊路由](./backend-design-02-api-routes.md#4-全局中间件与特殊路由)
- [错误响应格式](./backend-design-02-api-routes.md#5-错误响应格式)
- [指标端点详情](./backend-design-02-api-routes.md#6-指标端点详情)
- [中间件特殊处理](./backend-design-02-api-routes.md#7-中间件特殊处理)

### 3. 数据模型
- [核心数据模型](./backend-design-03-data-models.md#1-核心数据模型)
- [数据库 Schema](./backend-design-03-data-models.md#2-数据库-schema)
- [ER 关系图](./backend-design-03-data-models.md#3-er-关系)
- [版本与缓存策略](./backend-design-03-data-models.md#4-版本与缓存策略)
- [文件存储限制](./backend-design-03-data-models.md#5-文件存储限制)

### 4. 安全机制
- [认证流程](./backend-design-04-security.md#1-认证流程)
- [JWT 与 Token 机制](./backend-design-04-security.md#2-jwt-与-token-机制)
- [RBAC 权限模型](./backend-design-04-security.md#3-rbac-权限模型)
- [审计日志](./backend-design-04-security.md#4-审计日志)

### 5. MCP 工具
- [MCP 工具定义](./backend-design-05-mcp-tools.md#1-mcp-工具定义)
- [Skill 生命周期管理](./backend-design-05-mcp-tools.md#2-skill-生命周期管理)
- [Shell 命令白名单](./backend-design-05-mcp-tools.md#3-shell-命令白名单)
- [资源隔离与配额](./backend-design-05-mcp-tools.md#4-资源隔离与配额)
- [文件上传与存储限制](./backend-design-05-mcp-tools.md#5-文件上传与存储限制)

### 6. 服务层
- [服务架构](./backend-design-06-services.md#1-服务架构)
- [Email 与通知服务](./backend-design-06-services.md#2-email-与通知服务)
- [配置管理](./backend-design-06-services.md#3-配置管理)

### 7. 部署与运维
- [Docker 部署](./backend-design-07-deployment-ops.md#1-docker-部署)
- [环境配置](./backend-design-07-deployment-ops.md#2-环境配置)
- [日志规范](./backend-design-07-deployment-ops.md#3-日志规范)
- [运维工具](./backend-design-07-deployment-ops.md#4-运维工具)
- [非功能性需求（NFR）](./backend-design-07-deployment-ops.md#5-非功能性需求nfr)
- [数据库运维](./backend-design-07-deployment-ops.md#6-数据库运维)
- [Docker 环境变量示例](./backend-design-07-deployment-ops.md#7-docker-环境变量示例)

---

## 前后端对照清单

### 1. 数据模型层面
- 字段命名（snake_case vs camelCase）
- 字段类型（Pydantic vs TypeScript）
- 枚举值一致性
- 必填 vs 可选

### 2. API 接口层面
- 接口路径与方法（`/api/v1/...`）
- 请求参数与响应结构
- 错误码体系（`code` 字段）

### 3. 业务逻辑层面
- 验证规则（Skill 可见性、Token 权限）
- 状态转换（Skill 生命周期）
- 权限规则（RBAC）
- 流程顺序（认证流程）

### 4. 认证与安全层面
- Token 类型（Access / Refresh / API Token）
- 登录方式配置（Email OTP / SSO / LDAP）
- 密码策略

### 5. 功能开关层面
- 注册开关 (`ENABLE_PUBLIC_SIGNUP`)
- SSO/LDAP 配置 (`ENABLE_SSO`, `ENABLE_LDAP`)
- 审计日志 (`ENABLE_AUDIT_LOG`)
- RBAC (`ENABLE_RBAC`, `ENABLE_SKILL_VISIBILITY`)
