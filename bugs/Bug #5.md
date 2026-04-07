Bug #5: 大文件下载可能导致浏览器卡顿/OOM

位置:
- backend/services/skill.py:479-483 (后端 Base64 编码)
- frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx:199-200 (前端 JSON 处理)

问题描述:

后端将整个 ZIP 归档编码为 Base64 字符串放入 JSON 响应，前端接收后将整个响应序列化为 JSON 字符串再创建 Blob。对于大文件会导致浏览器内存压力过大。

```python
# 后端 - services/skill.py:479-483
if settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION:
    encrypted_code, checksum = self._encrypt_payload(archive_bytes)
else:
    encrypted_code = base64.b64encode(archive_bytes).decode("utf-8")  # 大文件 → 巨大字符串
    checksum = self._checksum_payload(archive_bytes)
```

```typescript
// 前端 - versions-tab.tsx:199-200
const result = await api.downloadSkill({ skill_uuid: skillUuid, version })
const content = JSON.stringify(result, null, 2)  // 二次序列化，体积增大 ~30%
const blob = new Blob([content], { type: "application/json" })
```

内存占用估算:
- 100MB 的 Skill 包 → Base64 后约 133MB → JSON 序列化后约 170MB
- 浏览器需要一次性分配 170MB+ 内存处理
- 对于大文件可能导致 UI 冻结甚至标签页崩溃

影响范围:
- 用户下载包含大量文件的 Skill 时浏览器卡死
- 低配置设备（<8GB 内存）更容易触发 OOM
- 移动端浏览器风险更高

修复建议:

方案 A: 后端改用 StreamingResponse 分块传输二进制文件
```python
from fastapi.responses import StreamingResponse
import io

@router.post("/download")
async def download_skill_binary(request, payload, current_user, session):
    # ... 业务逻辑 ...
    archive_bytes = await get_archive_data(skill, version)
    
    return StreamingResponse(
        io.BytesIO(archive_bytes),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{name}-{version}.zip"'
        }
    )
```

方案 B: 添加文件大小预检，超过阈值时提示用户
```python
MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024  # 50MB

# 在返回前检查
if len(archive_bytes) > MAX_DOWNLOAD_SIZE:
    raise HTTPException(
        status_code=413,
        detail=f"File too large ({len(archive_bytes)//1024//1024}MB). Max: {MAX_DOWNLOAD_SIZE//1024//1024}MB"
    )
```

方案 C: 前端优化处理逻辑（减少不必要的序列化）
```typescript
// 直接使用 API 响应，避免二次序列化
const result = await api.downloadSkill({ skill_uuid: skillUuid, version })
// 如果只需要保存加密内容，直接保存 encrypted_code 字段即可
const blob = new Blob([result.encrypted_code], { type: "text/plain" })
```
