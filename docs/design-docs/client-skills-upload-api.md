# 客户端 Skill 上传 API 设计说明

## 这份文档解决什么问题

客户端需要把本地 ZIP 形式的 SKILL 包上传到服务端，但现有
`POST /api/v1/skills/upload` 是 Web Console 的 JWT Session 接口。为了保持 API
边界清晰，客户端上传应放在 `/api/v1/client/skills/upload`，并且只接受 API Token。

这份文档记录该接口的稳定设计约定，具体产品范围见
`docs/product-specs/2026-05-01-client-skills-upload.md`。

## API 边界

Open SkillHub 的技能接口分为两类：

- Console API：`/api/v1/skills/...`，给 Web 管理后台使用，认证方式是 JWT Session。
- Client API：`/api/v1/client/skills/...`，给桌面客户端、CLI、CI 和自动化集成使用，认证方式是 API Token。

客户端上传属于 Client API。它不能复用 Console API 路径，也不能同时接受 JWT 和 API
Token，否则调用方很难判断权限、审计和错误语义。

## 模式选择

接口通过 `skill_uuid` 区分两种模式：

- 传入 `skill_uuid`：追加已有 SKILL 的新版本。
- 不传 `skill_uuid`：根据 ZIP 内根路径 `SKILL.md` 创建新 SKILL。

这种设计保留了现有 Console 上传接口的调用模型，也让客户端不需要额外传一个
`mode` 字段。

## 上传处理原则

### ZIP-only

客户端接口只接受 ZIP 包。非 ZIP 单文件上传仍然只属于 Console API，不进入 Client API。

这样做的原因是客户端同步的是完整 SKILL，而不是管理后台里的单文件编辑体验。Client API
接收完整包，可以复用现有 ZIP 校验、依赖探测、版本目录和归档逻辑。

### 创建模式以 `SKILL.md` 为准

创建新 SKILL 时，名称、版本、描述和依赖优先来自 ZIP 内的 `SKILL.md` frontmatter
和包内文件。`metadata` 不参与创建模式。

如果创建模式允许 `metadata` 覆盖 `SKILL.md`，调用方会面对两个真相源：ZIP 内声明和
表单字段。为了让客户端行为可预测，创建模式传入 `metadata` 应直接返回
`INVALID_METADATA`。

### 更新模式允许版本元数据覆盖

追加已有版本时，`metadata` 可以覆盖版本元数据里的 `version`、`description`、
`dependencies` 和 `dependency_spec`。它不重命名已有 SKILL，也不改变归属或可见性。

这是现有 `SkillUploadCoordinator.upload_zip_from_path()` 已支持的语义，应继续复用。

## 权限和所有权

- 认证依赖使用 `require_api_token_permission("skill.upload")`。
- 无 API Token 或误用 JWT access token 都应返回 `401`。
- API Token 所属用户没有 `skill.upload` 权限时返回 `403`。
- 更新模式只能操作 token 所属用户拥有的 SKILL。
- reference SKILL 是只读记录，不能被上传新版本。
- clone SKILL 如果属于当前用户，可以追加版本，并应保留 clone 来源元数据。

## 响应和错误

创建新 SKILL 和追加版本都返回 `201 Created`。虽然更新已有 SKILL 看起来像 update，但
实际行为是创建一个新的版本记录，并且现有 Console 上传接口也使用 `201`。

错误响应沿用全局错误结构：

```json
{
  "detail": "Skill already exists",
  "code": "SKILL_ALREADY_EXISTS",
  "timestamp": "2026-05-01T12:00:00Z"
}
```

服务层应继续通过 `SkillErrorCode` 和 `handle_skill_value_error()` 产出错误，不在路由里
手写一套新的错误格式。

## 审计日志

上传成功后写入审计日志：

- 追加版本：`skill.upload`
- 创建新 SKILL：`skill.create`

审计 metadata 应至少包含文件名、版本号和 `client_api=true`，以便后续区分 Web Console
上传和客户端上传来源。

## 不做什么

- 不改变 `/api/v1/skills/upload`。
- 不新增数据表、版本模型或归档格式。
- 不支持非 ZIP 单文件上传。
- 不让 Client API 变成通用 SKILL 编辑接口。
- 不在这次接口落地中修改桌面客户端。

## 稳定约定

- Client API 上传路径固定为 `/api/v1/client/skills/upload`。
- 认证固定为 API Token。
- `skill_uuid` 是模式选择依据。
- 创建模式以 ZIP 内 `SKILL.md` 为准。
- 更新模式只追加版本，不改变 SKILL 归属。
- 错误、审计、归档和版本递增都复用后端现有能力。
