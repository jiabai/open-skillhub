# 不开启 RBAC 情况下用户下载 Skill 的完整流程

> 本文档聚焦下载操作的端到端流程。权限模型和完整功能列表请参考 [feature-list-without-rbac.md](./feature-list-without-rbac.md)。

---

## 目录

- [整体流程](#整体流程)
- [接口详情](#接口详情)
- [下载加密](#下载加密)
- [速率限制](#速率限制)
- [前端下载体验](#前端下载体验)
- [错误码速查](#错误码速查)

---

## 整体流程

```mermaid
flowchart TD
    A["POST /api/v1/skills/download"] --> B["JWT 认证"]
    B --> C["RBAC 检查: skill.download"]
    
    C -->|"ENABLE_RBAC=False"| D["直接放行 ✅<br/>（RBAC 开启时仅 admin 可下载）"]
    C -->|"ENABLE_RBAC=True"| D2{"是 admin?"}
    D2 -->|"是"| D
    D2 -->|"否"| DENY["403 Permission Denied"]
    
    D --> E["速率限制检查<br/>（ENABLE_RATE_LIMIT=True 时生效）"]
    E --> F["查询 Skill 记录"]
    
    F -->|"不存在"| G["404 SKILL_NOT_FOUND"]
    F -->|"已停用"| H["410 SKILL_DEACTIVATED"]
    F -->|"存在"| I{"是 Reference Skill?"}
    
    I -->|"是"| J["解析源 Public Skill<br/>按 pinned → requested → current 优先级"]
    I -->|"否"| K["按 requested → current 优先级"]
    
    J --> L["查询 Version 记录"]
    K --> L
    
    L -->|"版本不存在"| M["404 VERSION_NOT_FOUND"]
    L -->|"版本存在"| N["从文件系统读取文件"]
    
    N --> O{"启用下载加密?<br/>ENABLE_SKILL_DOWNLOAD_ENCRYPTION"}
    O -->|"是"| P["AES-256-GCM 加密<br/>每个文件独立加密"]
    O -->|"否"| Q["返回原始文件内容"]
    
    P --> R["构建 SkillDownloadResponse"]
    Q --> R
    
    R --> S["可选: 写审计日志"]
    S --> T["200 OK + JSON 响应"]

    style D fill:#c8e6c9,stroke:#2e7d32
    style P fill:#fff3e0,stroke:#ef6c00
```

**RBAC 关闭后的关键变化**：下载权限从 admin-only 变为所有已认证用户可用。这是 RBAC 关闭后最常被感知的权限变化。

---

## 接口详情

### 请求

```
POST /api/v1/skills/download
Content-Type: application/json
```

```json
{
  "skill_uuid": "目标 Skill 的 UUID（必填）",
  "version": "1.0.0"              // 可选，省略则下载 current_version
}
```

### 响应

```json
{
  "skill_uuid": "abc-123",
  "name": "my-data-analyzer",
  "version": "1.0.0",
  "files": [
    {
      "path": "main.py",
      "content": "base64 编码的文件内容...",
      "size": 1234
    },
    {
      "path": "SKILL.md",
      "content": "base64 编码的文件内容...",
      "size": 567
    }
  ],
  "metadata": {},
  "encryption_enabled": false,
  "archive_size_bytes": 5678,
  "download_filename": "my-data-analyzer-1.0.0"
}
```

关键字段说明：

- `files[].content` — 未加密时为原始文件的 base64 编码；加密时为 AES-256-GCM 加密后的 base64 密文
- `encryption_enabled` — 标识本次下载是否启用了加密
- `archive_size_bytes` — 归档包的字节大小
- `download_filename` — 建议的下载文件名（前端实际使用的命名是 `skill-{uuid前8位}-{version}.json`）

---

## 下载加密

当 `ENABLE_SKILL_DOWNLOAD_ENCRYPTION=True` 时，下载的每个文件都会被独立加密。

```mermaid
flowchart LR
    A["原始文件内容"] --> B["AES-256-GCM 加密"]
    B --> C["Base64 编码"]
    C --> D["写入 response.files[].content"]
    
    KEY["SECRET_KEY + salt<br/>→ derive_aes256_key()"] --> B
```

- 密钥派生：使用 `settings.SECRET_KEY` 和固定盐值 `"skill-download-encryption"` 通过 `derive_aes256_key()` 生成 256 位 AES 密钥
- 加密方式：每个文件独立加密，互不影响
- 前端处理：当前前端直接将 API 响应序列化为 JSON 下载，不做客户端解密。如果启用加密，下载的文件内容将是密文，需要使用共享密钥在客户端或其他工具中解密

配置：
```env
ENABLE_SKILL_DOWNLOAD_ENCRYPTION=False  # 默认关闭
SECRET_KEY=your-secret-key              # 用于派生加密密钥
```

---

## 速率限制

当 `ENABLE_RATE_LIMIT=True` 时，下载接口受滑动窗口限流保护。

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS` | 60 | 窗口内最大请求数 |
| `SKILL_DOWNLOAD_RATE_LIMIT_WINDOW` | 60 | 窗口宽度（秒） |

超出限制时返回：
```
429 Too Many Requests
{ "detail": "Too many download requests. Please try again later.", "code": "RATE_LIMIT_EXCEEDED" }
```

限流键为用户 ID（已登录）或客户端 IP（未登录场景），同一键在窗口内的请求计数超限即触发。

---

## 前端下载体验

### 入口位置

下载按钮在 **Skill 详情页 → 版本标签 → 选中单个版本后** 的操作按钮组中，与"安装说明"和"回滚"按钮并列。

```
┌─────────────────────────────────────────────────────────────┐
│  Skill: My Awesome Skill                                    │
│  [基本信息] [文件] [版本 ✓] [依赖] [设置]                    │
├────────────────────────┬────────────────────────────────────┤
│  版本列表              │     版本 1.0.0                     │
│  ┌──────────────────┐  │     ─────────────────────          │
│  ☑ 1.0.0 (当前)     │  │     创建于 2026-04-07 16:00       │
│  ☐ 0.9.0            │  │                                     │
│  └──────────────────┘  │     ┌──────────┬──────────┬──────┐ │
│                        │     │ 安装说明  │  下载    │ 回滚 │ │
│                        │     └──────────┴──────────┴──────┘ │
└────────────────────────┴────────────────────────────────────┘
```

### 前端处理逻辑

```
1. 调用后端 API: POST /api/v1/skills/download
2. 接收 JSON 响应（包含文件列表、元数据等）
3. JSON.stringify() 序列化为格式化字符串
4. 创建 Blob 对象 + 生成临时 Object URL
5. 触发浏览器原生下载
6. 文件名格式: skill-{uuid前8位}-{version}.json
7. 清理临时 DOM 元素和 Object URL
```

前端不区分加密与非加密——两种情况下都是直接将 API 响应整体下载为 JSON 文件。加密场景下需要在下载后使用外部工具解密。

---

## 错误码速查

| 场景 | HTTP 状态码 | 错误码 |
|------|------------|--------|
| Skill 不存在 | 404 | `SKILL_NOT_FOUND` |
| Skill 已停用 | 410 | `SKILL_DEACTIVATED` |
| 指定版本不存在 | 404 | `VERSION_NOT_FOUND` |
| 下载包过大 | 413 | 无特定错误码，返回大小信息 |
| 速率超限 | 429 | `RATE_LIMIT_EXCEEDED` |
| 公共 Skill 功能未启用 | 404 | `PUBLIC_SKILLS_DISABLED` |
| 未登录 | 401 | 无有效 JWT |

---

## 安全边界

RBAC 关闭后，以下机制**仍然生效**：

| 安全层 | 说明 |
|--------|------|
| JWT 认证 | 必须携带有效 Token，验签+过期校验 |
| 用户活跃状态 | `is_active=True` 才能通过 |
| Token 版本校验 | `jwt_token_version` 防重放攻击 |
| Skill 可见性控制 | 可选，取决于 `ENABLE_SKILL_VISIBILITY` |
| 路径遍历防护 | 文件系统安全 |
| 下载大小限制 | 避免超大响应 |
| 速率限制 | 可选，防止滥用 |
| 审计日志 | 可选，取决于 `ENABLE_AUDIT_LOG` |

**RBAC 关闭后被跳过的**：角色权限验证（`skill.download` 从 admin-only 变为所有人可用）。

---

## 配置汇总

```env
# 下载权限
ENABLE_RBAC=False                        # 关闭后所有已认证用户可下载

# 下载安全
ENABLE_SKILL_DOWNLOAD_ENCRYPTION=False   # 下载加密
ENABLE_RATE_LIMIT=False                  # 速率限制
SKILL_DOWNLOAD_RATE_LIMIT_REQUESTS=60    # 窗口内最大请求数
SKILL_DOWNLOAD_RATE_LIMIT_WINDOW=60      # 窗口宽度(秒)

# 审计
ENABLE_AUDIT_LOG=False                   # 下载操作审计
```
