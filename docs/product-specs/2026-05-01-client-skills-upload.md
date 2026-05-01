# 客户端 Skills 上传接口

## 背景

当前 `POST /api/v1/skills/upload` 使用 JWT Session 认证
（`require_permission("skill.upload")`），主要服务 Web 管理后台。桌面客户端和
自动化集成使用 API Token 认证，不能调用这个 Console API。

桌面客户端新增的“本地 SKILL 管理”能力需要把本地探测到、服务端尚不存在或需要
追加版本的 SKILL 上传到服务端。因此需要在 Client API 下新增一个 API-token-only
上传接口，并继续遵守后端作为权限和能力真相源的边界。

## 目标

1. 新增 `POST /api/v1/client/skills/upload`，只接受 API Token 认证。
2. 仅支持上传 ZIP 格式的 SKILL 包，包内必须包含根路径 `SKILL.md`。
3. 支持两种上传模式：
   - **追加已有 SKILL 版本**：传入 `skill_uuid`，把 ZIP 内容作为该 SKILL 的新版本。
   - **创建新 SKILL**：不传 `skill_uuid`，从 ZIP 中的 `SKILL.md` frontmatter 解析名称并创建当前 API Token 所属用户拥有的 SKILL。
4. 复用现有上传链路：`stream_upload_to_temp_file()`、`SkillService.upload_zip_from_path()`、`SkillService.upload_zip_create_skill_from_path()` 和统一错误映射。
5. 上传成功后写入审计日志，追加版本记录 `skill.upload`，创建新 SKILL 记录 `skill.create`。
6. 增加客户端接口回归测试，覆盖认证、权限、创建、追加版本、错误响应和审计日志。

## 非目标

- 不支持非 ZIP 格式的单文件上传；客户端上传场景只接受完整 SKILL 包。
- 不改变现有 `POST /api/v1/skills/upload` 的行为、认证方式或响应形状。
- 不改变 SKILL 数据模型、版本模型、归档格式或存储路径。
- 不在本接口中实现 SKILL 编辑、删除、版本回滚或下载。
- 不在本轮改动桌面客户端；桌面客户端调用可以在接口落地后单独计划。
- 不让创建模式通过 `metadata` 覆盖 `SKILL.md` frontmatter；创建新 SKILL 时以 ZIP 内 `SKILL.md` 为准。

## 使用场景

1. 桌面客户端发现本地某个 SKILL 不存在于服务端时，上传 ZIP 包并创建用户私有空间中的新 SKILL。
2. 桌面客户端发现某个已同步 SKILL 有本地更新时，传入 `skill_uuid` 上传 ZIP 包并追加新版本。
3. 自动化集成使用 API Token 执行同样的 ZIP 上传工作流，而不需要浏览器 JWT Session。

## API 设计

### 路由

```http
POST /api/v1/client/skills/upload
```

注册在 `backend/api/v1/client_skills.py`，沿用 `backend/api/router.py` 中
`/client/skills` 的路由前缀。

### 认证与授权

- 使用 API Token Bearer Token。
- 通过 `require_api_token_permission("skill.upload")` 校验权限。
- 不接受 JWT Session。用 JWT access token 调用该接口应返回 `401`。
- `skill_uuid` 更新模式只能操作当前 API Token 所属用户拥有的非 reference SKILL。
- reference SKILL 是只读记录，上传新版本时应返回 `409` 和 `REFERENCE_SKILL_READ_ONLY`。

### 请求

**Content-Type**: `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | `UploadFile` | 是 | ZIP 格式的 SKILL 包，文件名必须以 `.zip` 结尾，包内必须包含根路径 `SKILL.md` |
| `skill_uuid` | `str` | 否 | 已有 SKILL 的 UUID；传入则追加版本，不传则创建新 SKILL |
| `visibility` | `str` | 否 | 仅创建新 SKILL 时生效，可选 `private` / `team` / `enterprise`，默认 `private` |
| `metadata` | `str` | 否 | 仅追加已有 SKILL 版本时支持的 JSON 字符串，可覆盖版本元数据中的 `version`、`description`、`dependencies` 或 `dependency_spec`；不重命名 SKILL |

创建模式如果传入 `metadata`，接口应返回 `400` 和 `INVALID_METADATA`，避免调用方误以为创建时会覆盖 `SKILL.md`。

### 响应

为复用现有 Console API 上传语义，创建新 SKILL 和追加版本都返回 `201 Created`。

**追加已有 SKILL 版本**：

```json
{
  "version": "1.2.0",
  "current_version": "1.2.0",
  "dependencies": []
}
```

**创建新 SKILL**：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-skill",
  "description": "A useful skill",
  "version": "1.0.0",
  "current_version": "1.0.0",
  "dependencies": []
}
```

### 错误处理

沿用后端统一错误响应。服务层错误通过 `handle_skill_value_error()` 映射成
`HTTPException`，再由全局异常处理器补齐 `timestamp`：

```json
{
  "detail": "SKILL.md not found in zip",
  "code": "SKILL_MD_NOT_FOUND_IN_ZIP",
  "timestamp": "2026-05-01T12:00:00Z"
}
```

常见错误：

| 状态码 | code | 说明 |
|--------|------|------|
| `400` | `INVALID_ZIP_FILE` | 文件名不是 `.zip` 或 ZIP 内容无法读取 |
| `400` | `ZIP_EMPTY` | ZIP 包为空 |
| `400` | `SKILL_MD_NOT_FOUND_IN_ZIP` | 创建新 SKILL 时 ZIP 根路径未找到 `SKILL.md` |
| `400` | `SKILL_MD_NOT_FOUND` | 追加版本时 ZIP 根路径未找到 `SKILL.md` |
| `400` | `SKILL_MD_NAME_MISSING` | 创建新 SKILL 时 `SKILL.md` frontmatter 缺少 `name` |
| `400` | `INVALID_SKILL_NAME` | SKILL 名称不合法 |
| `400` | `INVALID_VISIBILITY` | `visibility` 值不合法 |
| `400` | `INVALID_METADATA` | `metadata` 不是 JSON object，或在创建模式传入 `metadata` |
| `400` | `TOO_MANY_FILES` | ZIP 内文件数量超过限制 |
| `400` | `TOTAL_SKILL_SIZE_LIMIT_EXCEEDED` | ZIP 解压后总大小超过限制 |
| `401` | `UNAUTHORIZED` | API Token 缺失、无效，或误用 JWT Session |
| `403` | `FORBIDDEN` | API Token 所属用户无 `skill.upload` 权限 |
| `404` | `SKILL_NOT_FOUND` | `skill_uuid` 不存在或不属于当前用户 |
| `409` | `SKILL_ALREADY_EXISTS` | 创建新 SKILL 时同名记录已存在 |
| `409` | `REFERENCE_SKILL_READ_ONLY` | 尝试给 reference SKILL 上传新版本 |
| `413` | `FILE_TOO_LARGE` | 上传流或 ZIP 内单文件超过限制 |

## 实现要点

### 路由层

在 `backend/api/v1/client_skills.py` 增加 `POST /upload`。路由结构参考现有
`POST /api/v1/skills/upload`，但认证依赖必须替换为 API Token 版本：

```python
@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_client_skill(
    request: Request,
    file: UploadFile = File(...),
    skill_uuid: str | None = Form(None),
    visibility: str = Form("private"),
    metadata: str | None = Form(None),
    current_user=Depends(require_api_token_permission("skill.upload")),
    session=Depends(get_async_session),
):
    ...
```

路由应复用 `build_skill_service(session)`，不要在路由里直接访问 repository 或存储路径。

### 上传处理

- 使用 `MAX_TOTAL_SIZE` 作为客户端 ZIP 上传流上限。
- 使用 `stream_upload_to_temp_file(file, MAX_TOTAL_SIZE)` 流式写入临时文件。
- 使用 `filename.lower().endswith(".zip")` 和服务层 `validate_zip_archive()` 共同保证 ZIP-only。
- `finally` 中关闭上传文件并删除临时文件。

### 服务层复用

- 追加已有 SKILL 版本：调用 `service.upload_zip_from_path(current_user, skill_uuid, filename, temp_path, metadata_text=metadata)`。
- 创建新 SKILL：调用 `service.upload_zip_create_skill_from_path(current_user, filename, temp_path, visibility)`。
- 不为客户端上传新增一套解析、解压、归档或版本递增逻辑。

### 审计日志

- 追加版本成功后调用 `create_audit_event(..., "skill.upload", skill_uuid, metadata={"filename": filename, "archive": True, "version": payload.get("version"), "client_api": True})`。
- 创建新 SKILL 成功后调用 `create_audit_event(..., "skill.create", payload.get("id", ""), metadata={"filename": filename, "name": payload.get("name"), "version": payload.get("version"), "client_api": True})`。

## 约束

- 接口认证必须使用 API Token，不接受 JWT Session。
- 上传文件大小限制沿用 `MAX_TOTAL_SIZE`。
- 版本号冲突时沿用 `SkillUploadCoordinator.next_version()` 的自动递增逻辑。
- 客户端上传不能绕过 `route -> service -> repository -> database/filesystem` 边界。
- 响应字段与现有 Console API 上传返回保持一致，便于客户端复用解析逻辑。

## 验收标准

- 有效 API Token + `skill.upload` 权限可以上传 ZIP 包并创建新 SKILL，响应 `201`。
- 有效 API Token + `skill.upload` 权限可以上传 ZIP 包并给已有 SKILL 追加版本，响应 `201`。
- 无 `skill.upload` 权限的 API Token 返回 `403` 和 `FORBIDDEN`。
- 无 API Token 的请求返回 `401` 和 `UNAUTHORIZED`。
- JWT Session 认证的请求返回 `401`，证明该接口仅接受 API Token。
- 非 `.zip` 文件或坏 ZIP 返回 `400` 和 `INVALID_ZIP_FILE`。
- ZIP 中缺少根路径 `SKILL.md` 时返回对应缺失错误码。
- 创建新 SKILL 时缺少 `name` 返回 `400` 和 `SKILL_MD_NAME_MISSING`。
- 创建新 SKILL 时名称冲突返回 `409` 和 `SKILL_ALREADY_EXISTS`。
- 追加 reference SKILL 版本返回 `409` 和 `REFERENCE_SKILL_READ_ONLY`。
- 创建模式传入 `metadata` 返回 `400` 和 `INVALID_METADATA`。
- 上传操作写入审计日志，并能区分 `skill.upload` 与 `skill.create`。
- 现有 `POST /api/v1/skills/upload` 行为不受影响。
