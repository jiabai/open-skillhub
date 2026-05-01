# 用户级下载加密密钥管理

<!-- [STATUS] 未实现 (Not Implemented) -->
> 状态：设计文档
> 范围：`backend/` + `desktop-client/`

## 问题

当前下载加密使用全局 `SECRET_KEY` 作为密钥源，所有用户共享同一个加密密钥。
桌面客户端需要通过环境变量 `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET` 传入该密钥，
且客户端不持久化存储，每次启动都需要重新配置。

这对个人用户场景不友好：

1. 用户无法自主选择是否启用加密
2. 每次启动客户端都需要配置环境变量
3. 所有用户共享同一密钥，一个泄露全部受影响
4. 无法支持不同用户使用不同加密方案

## 设计目标

- 每个用户独立维护自己的下载加密密钥
- 用户可以选择不使用加密、一键生成密钥、或自定义密钥
- 客户端通过 keytar 安全持久化用户的解密密钥
- 保持 fail-closed 安全原则不变

## 当前实现分析

### 后端加密链路

```
settings.SECRET_KEY
    → build_encryption_key(secret, "skill-download-encryption")
        → derive_aes256_key(secret, purpose)  # HKDF-SHA256, salt="open-skillhub:key-derivation:v1"
            → AES-256-GCM 加密
```

关键文件：

- `backend/config/settings.py`：`ENABLE_SKILL_DOWNLOAD_ENCRYPTION` 全局开关，`SECRET_KEY` 全局密钥
- `backend/services/skill.py`：`_encrypt_payload()` 使用 `settings.SECRET_KEY` 加密
- `backend/services/skill_download.py`：`build_download_payload()` 根据 `settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION` 决定是否加密
- `backend/core/utils/key_derivation.py`：HKDF 密钥派生
- `backend/api/v1/client_skills.py`：客户端下载 API，使用 `require_api_token_skill_download_access` 鉴权

### 客户端解密链路

```
process.env.OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET
    → createDecryptArtifactFromEnv(process.env)
        → getDownloadDecryptionSecret(env)
            → deriveAes256Key(secret)  # 同样的 HKDF-SHA256
                → AES-256-GCM 解密
```

关键文件：

- `electron/encryption.ts`：从环境变量读取密钥，HKDF 派生，AES-GCM 解密
- `electron/main.ts`：`createDecryptArtifactFromEnv(process.env)` 创建解密器
- `src/core/storage/secret-store.ts`：keytar 安全存储（当前仅存 API Token）
- `src/core/runtime/runtime-config-manager.ts`：运行时配置管理

### 现有安全存储能力

客户端已有 `SecretStore` 接口和 keytar 实现：

```typescript
interface SecretStore {
  getApiToken(): Promise<string | null>
  setApiToken(token: string): Promise<void>
  clearApiToken(): Promise<void>
}
```

keytar 服务名为 `OpenSkillHub`，当前仅存储 `api-token` 账户。
可以扩展为存储 `download-decryption-secret` 账户。

## 方案调整

基于代码实现分析，原方案需要以下调整：

### 调整 1：不在 User 模型中存储加密密钥明文

原方案建议在 User 模型中新增 `download_encryption_secret` 字段存储密钥。
但后端加密密钥不应以明文形式存储在数据库中——这与 `SECRET_KEY` 不入库的原则矛盾。

**调整方案**：后端仅存储用户级加密开关和密钥的不可逆摘要（用于验证），
密钥本身只在生成时展示一次，由用户复制到客户端。这与 API Token 的管理模式一致。

### 调整 2：加密决策从全局开关改为用户级

当前 `settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION` 是全局布尔值。
需要改为：全局开关保留作为"平台是否允许加密"的总控，
同时新增用户级开关控制"该用户是否启用加密"。

加密决策逻辑：

```
encryption_enabled = settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION AND user.download_encryption_enabled
```

当 `encryption_enabled = False` 时，下载响应中 `encrypted_code` 为明文 base64，
`encryption_enabled = False`，客户端无需解密。

### 调整 3：密钥传递方式改为 API 下发 + 客户端 keytar 持久化

原方案中密钥通过环境变量传递。调整为：

1. 后端 API 在用户生成/更新密钥时，一次性返回密钥明文
2. 客户端通过 IPC 将密钥存入 keytar（与 API Token 同等安全级别）
3. 后续下载时，客户端从 keytar 读取密钥进行解密
4. 环境变量 `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET` 保留为向后兼容的 fallback

### 调整 4：下载 API 需要告知客户端加密状态

当前 `SkillDownloadResponse` 已有 `encryption_enabled` 字段。
但客户端需要知道该用户是否启用了加密，以便在缺少密钥时给出明确提示。

新增：`GET /api/v1/client/skills/cache-policy` 已返回 `download_encryption_enabled`，
但该值来自全局设置。需要改为反映用户级设置。

## 详细设计

### 后端变更

#### 1. User 模型扩展

`backend/models/user.py` 新增字段：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `download_encryption_enabled` | `Boolean` | `False` | 用户是否启用下载加密 |
| `download_encryption_key_hash` | `String(128) \| None` | `None` | 密钥的 SHA-256 摘要，用于验证而非还原 |

密钥本身不存储。`download_encryption_key_hash` 仅用于验证用户提交的密钥是否正确，
不可逆推原始密钥。

#### 2. 新增 API 端点

##### `GET /api/v1/users/me/encryption-settings`

获取当前用户的加密设置：

```json
{
  "download_encryption_enabled": false,
  "has_encryption_key": false
}
```

##### `PUT /api/v1/users/me/encryption-settings`

更新加密设置：

```json
{
  "download_encryption_enabled": true
}
```

启用加密前必须先生成密钥。

##### `POST /api/v1/users/me/encryption-key/generate`

生成新的用户级加密密钥。返回值中包含密钥明文（仅此一次）：

```json
{
  "encryption_key": "sk-dl-a1b2c3d4e5f6...",
  "key_hash": "sha256:abc123...",
  "generated_at": "2026-05-01T12:00:00Z",
  "warning": "请立即复制此密钥到您的桌面客户端。此密钥不会再次显示。"
}
```

密钥格式：`sk-dl-` 前缀 + 32 字节随机 base64url 编码，总长度 ≥ 48 字符。

##### `POST /api/v1/users/me/encryption-key/verify`

验证用户提交的密钥是否与存储的摘要匹配：

```json
// 请求
{
  "encryption_key": "sk-dl-a1b2c3d4e5f6..."
}
// 响应
{
  "valid": true
}
```

此端点供客户端验证用户粘贴的密钥是否正确。

#### 3. 加密逻辑改造

`backend/services/skill_download.py` 的 `build_download_payload` 方法：

```python
# 当前
if settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION:
    encrypted_code, checksum = self._encrypt_payload(archive_bytes)

# 改为
user_encryption_enabled = (
    settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION
    and getattr(user, "download_encryption_enabled", False)
)
if user_encryption_enabled:
    encrypted_code, checksum = self._encrypt_payload(
        archive_bytes,
        secret=getattr(user, "_download_encryption_secret", None),
    )
```

`_encrypt_payload` 需要支持传入用户级密钥。当用户级密钥存在时使用用户密钥，
否则回退到 `settings.SECRET_KEY`（向后兼容）。

密钥传递方式：在 `download_skill` 调用链中，通过方法参数传递用户对象，
`build_download_payload` 从用户对象读取加密设置。
用户级密钥不在数据库中存储，因此下载时后端需要从请求上下文中的用户记录读取
`download_encryption_key_hash` 来确认密钥已设置，但实际加密使用的密钥
需要在用户生成密钥时通过安全通道传递给后端内存。

**关键设计决策**：后端加密使用的密钥来源

由于密钥明文不存储在数据库中，后端在加密下载包时需要获取密钥。
有两种方案：

**方案 A**：后端存储密钥（加密存储）
- 后端用 `SECRET_KEY` 派生的密钥加密用户的下载密钥后存入数据库
- 下载时解密取出使用
- 优点：用户无需在客户端配置密钥即可使用加密下载
- 缺点：后端存储了可还原的密钥

**方案 B**：客户端持有密钥，后端仅验证
- 后端仅存储密钥摘要，不存储可还原的密钥
- 加密操作仍在后端执行，但密钥来源改为：用户首次生成密钥时，
  后端在内存中缓存该密钥（session 级别），或要求客户端在下载请求中传入密钥
- 优点：后端不存储可还原密钥
- 缺点：架构更复杂

**推荐方案 A**：后端加密存储用户密钥。理由：

1. 加密操作在后端执行（当前架构如此），后端必须能获取密钥明文
2. 用 `SECRET_KEY` 派生的密钥加密存储，安全性等同于 `SECRET_KEY` 本身
3. 用户体验更好——无需在客户端额外配置密钥
4. 客户端只需存储解密密钥，不需要参与加密流程

新增字段调整：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `download_encryption_enabled` | `Boolean` | `False` | 用户是否启用下载加密 |
| `download_encryption_key_encrypted` | `Text \| None` | `None` | 用 SECRET_KEY 派生密钥加密后的用户下载密钥 |
| `download_encryption_key_hash` | `String(128) \| None` | `None` | 密钥明文的 SHA-256 摘要，用于客户端验证 |

#### 3.5 密钥管理原理详解

##### 用户密钥的生成（与 SECRET_KEY 无关）

每个用户的密钥是**完全随机生成**的，与 `SECRET_KEY` 无关：

```python
import secrets
import base64

# 生成 32 字节的随机值
user_key_bytes = secrets.token_bytes(32)

# 加上前缀并转换为 base64url
user_key_plain = "sk-dl-" + base64.urlsafe_b64encode(user_key_bytes).rstrip(b'=').decode('utf-8')
# 结果示例：sk-dl-aBc1dEf2GhIjKlMnOpQrStUvWxYz1234567890
```

每个用户的密钥都是唯一的，互不关联。

##### 存储前的加密包装（Key Wrapping）

为了安全存储用户密钥到数据库，我们使用 `SECRET_KEY` 派生的密钥进行加密包装：

```python
from backend.config.settings import settings
from backend.core.utils.key_derivation import derive_aes256_key
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import secrets
import hashlib
import base64

# 1. 用 SECRET_KEY 派生一个包装密钥（Wrap Key）
#    与下载加密使用不同的 purpose，确保密钥隔离
wrap_key = derive_aes256_key(settings.SECRET_KEY, "user-download-key-wrap")

# 2. 加密用户密钥
nonce = secrets.token_bytes(12)
aesgcm = AESGCM(wrap_key)
user_key_encrypted = nonce + aesgcm.encrypt(nonce, user_key_plain.encode('utf-8'), None)

# 3. 计算密钥摘要（用于验证）
user_key_hash = hashlib.sha256(user_key_plain.encode('utf-8')).hexdigest()

# 4. 存入数据库
user.download_encryption_key_encrypted = base64.b64encode(user_key_encrypted).decode('utf-8')
user.download_encryption_key_hash = "sha256:" + user_key_hash
```

##### 使用时的解密流程

当需要用该用户的密钥加密下载包时：

```python
# 1. 从数据库读取加密后的密钥
user_key_encrypted = base64.b64decode(user.download_encryption_key_encrypted)

# 2. 用同样的包装密钥解密
wrap_key = derive_aes256_key(settings.SECRET_KEY, "user-download-key-wrap")
nonce = user_key_encrypted[:12]
ciphertext = user_key_encrypted[12:]
aesgcm = AESGCM(wrap_key)
user_key_plain = aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')

# 3. 用解密出的用户密钥加密下载包
#    （继续沿用现有的加密流程）
```

##### 设计类比

这就像你管理多个保险箱：

- **保险箱 A**（数据库）：存放所有物品，但钥匙孔暴露在外
- **小盒子 B**（用户密钥加密）：把每个用户的钥匙（用户密钥）放进小盒子里
- **万能钥匙**（SECRET_KEY）：只有用它才能打开小盒子 B 取出用户钥匙

这样即使保险箱 A 被打开，没有万能钥匙也拿不到用户的钥匙。

##### 两个关键概念的区分

| 操作 | 目的 | 是否与 SECRET_KEY 有关 |
|------|------|-----------------------|
| **用户密钥生成** | 每个用户独立生成自己的密钥 | ❌ 无关，完全随机 |
| **用户密钥存储加密** | 保护存入数据库前加密 | ✅ 有关，用 SECRET_KEY 派生密钥加密 |

#### 4. cache-policy 端点改造

`GET /api/v1/skills/cache-policy` 需要反映用户级加密状态：

```python
# 当前
download_encryption_enabled=settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION

# 改为
download_encryption_enabled=(
    settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION
    and current_user.download_encryption_enabled
)
```

客户端 API `GET /api/v1/client/skills/cache-policy` 同理。

### 客户端变更

#### 1. SecretStore 扩展

`src/core/storage/secret-store.ts` 新增下载解密密钥的存取：

```typescript
export interface SecretStore {
  getApiToken(): Promise<string | null>
  setApiToken(token: string): Promise<void>
  clearApiToken(): Promise<void>
  // NEW
  getDownloadDecryptionSecret(): Promise<string | null>
  setDownloadDecryptionSecret(secret: string): Promise<void>
  clearDownloadDecryptionSecret(): Promise<void>
}
```

keytar 账户名：`download-decryption-secret`，服务名仍为 `OpenSkillHub`。

#### 2. IPC 扩展

`electron/ipc.ts` 新增 channel：

```typescript
export const desktopClientIpcChannels = {
  // ...existing
  saveDownloadDecryptionSecret: "configuration:save-download-decryption-secret",
  clearDownloadDecryptionSecret: "configuration:clear-download-decryption-secret",
}
```

`DesktopClientBridge` 和 `DesktopClientIpcHandlers` 新增对应方法。

#### 3. ConfigurationState 扩展

`src/types/index.ts` 中 `ConfigurationState` 新增：

```typescript
export interface ConfigurationState {
  // ...existing
  hasDownloadDecryptionSecret: boolean
  downloadEncryptionEnabled: boolean  // 来自后端 cache-policy
}
```

#### 4. 解密密钥来源优先级

```
1. keytar 安全存储（用户通过 UI 配置的）  ← 最高优先级
2. 环境变量 OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET  ← 向后兼容 fallback
3. 未配置  ← 加密下载将 fail-closed
```

这与 API Token 的优先级模式一致（keytar > 环境变量 > 未配置）。

#### 5. encryption.ts 改造

`electron/encryption.ts` 的 `createDecryptArtifactFromEnv` 需要支持
从 SecretStore 读取密钥，而非仅从环境变量：

```typescript
// 当前
export function createDecryptArtifactFromEnv(
  env: NodeJS.ProcessEnv = process.env
): DecryptArtifact

// 改为
export function createDecryptArtifactFromSecrets(
  secretStore: SecretStore,
  env: NodeJS.ProcessEnv = process.env
): DecryptArtifact
```

优先从 `secretStore.getDownloadDecryptionSecret()` 读取，
回退到 `env.OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET`。

#### 6. UI 变更

Settings 面板新增"下载加密"区域：

```
┌─────────────────────────────────────────────────────────────┐
│ 下载加密                                                    │
│                                                             │
│ 服务器加密状态：已开启                                       │
│                                                             │
│ 解密密钥                                                    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ •••••••••••••••••••••                    [👁]        │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ [保存密钥]    [清除密钥]    [验证密钥]                      │
│                                                             │
│ 状态：密钥已保存到系统凭证存储                              │
│                                                             │
│ ⚠ 获取密钥：前往 Web 控制台 → 用户设置 → 下载加密          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

当服务器端该用户未启用加密时，显示"服务器未启用加密"，
隐藏密钥输入区域。

### 数据库迁移

`backend/db/migrations/versions/` 新增迁移：

```python
def upgrade():
    op.add_column('users', sa.Column('download_encryption_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('download_encryption_key_encrypted', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('download_encryption_key_hash', sa.String(128), nullable=True))

def downgrade():
    op.drop_column('users', 'download_encryption_key_hash')
    op.drop_column('users', 'download_encryption_key_encrypted')
    op.drop_column('users', 'download_encryption_enabled')
```

## 安全分析

### 与现有安全规则的一致性

| 规则 | 满足情况 |
|------|---------|
| Token 不写入明文 JSON config | ✅ 密钥通过 keytar 存储，不写入 JSON |
| Token 不暴露给渲染进程 | ✅ `ConfigurationState` 仅返回 `hasDownloadDecryptionSecret: boolean` |
| Token 不记录到日志 | ✅ 密钥不记录到日志 |
| Fail-closed | ✅ 密钥缺失时解密失败，不会静默跳过 |
| 主进程持有权限 | ✅ 密钥存取仅在主进程通过 IPC |

### 新增安全考量

1. **密钥生成端点安全**：`POST /me/encryption-key/generate` 仅返回一次密钥明文，
   后续调用会生成新密钥并使旧密钥失效
2. **密钥验证端点**：`POST /me/encryption-key/verify` 有速率限制，防止暴力破解
3. **向后兼容**：环境变量方式继续有效，不破坏现有部署

## 向后兼容

| 场景 | 行为 |
|------|------|
| 后端未升级，客户端已升级 | 客户端回退到环境变量方式，功能不变 |
| 后端已升级，客户端未升级 | 后端对未设置用户级密钥的用户使用 `SECRET_KEY` 加密，客户端通过环境变量解密 |
| 全局加密关闭 | 所有用户下载均不加密，与当前行为一致 |
| 用户未启用加密 | 该用户下载不加密，客户端无需密钥 |
| 用户启用加密但未配置密钥 | 后端拒绝启用加密，要求先生成密钥 |

## 不做什么

- 不改变 HKDF 密钥派生算法（salt、purpose 保持不变）
- 不支持多种加密算法（保持 AES-256-GCM 唯一选项）
- 不在 Web 控制台 UI 中展示密钥明文（仅生成时展示一次）
- 不实现密钥轮换自动化（用户手动生成新密钥）
- 不改变客户端 API 的鉴权模型

## 相关文档

- 安全规则：`docs/SECURITY.md`
- 客户端 API 契约：`docs/references/client-api-contract.md`
- 运行时存储面：`docs/references/runtime-and-storage-surface.md`
- API Token 配置技术设计：`docs/design-docs/api-token-config-technical.md`
- 加密包解密器执行计划：`docs/exec-plans/completed/2026-05-01-encrypted-package-decryptor.md`
