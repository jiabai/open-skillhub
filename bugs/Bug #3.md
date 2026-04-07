Bug #3: 无请求体大小限制（DoS 风险）

位置:
- backend/api/v1/skills.py:282-286 (下载接口入口)
- 对比: backend/api/v1/skills.py:33-53 (上传接口有流式处理和显式大小检查)

问题描述:

下载接口使用 POST 方法接收 JSON 请求体 (SkillDownloadRequest)，但没有显式限制请求体大小。虽然 FastAPI/Starlette 有默认限制，但在反向代理配置不当的情况下可能被绕过。

对比上传接口使用了流式处理和显式大小检查 (MAX_FILE_SIZE, MAX_TOTAL_SIZE)。

```python
# 当前实现 - skills.py:282-286
@router.post("/download", response_model=SkillDownloadResponse)
async def download_skill(
    request: Request,
    payload: SkillDownloadRequest,  # ← 无大小限制
    current_user=Depends(require_permission("skill.download")),
    session=Depends(get_async_session),
):
```

影响范围: 恶意用户发送超大 payload 可能导致内存耗尽，造成拒绝服务攻击。

修复建议:

方案 A: 使用中间件统一限制
```python
@app.middleware("http")
async def limit_request_size(request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 1 * 1024 * 1024:  # 1MB
        raise HTTPException(413, "Request too large")
    return await call_next(request)
```

方案 B: 在 Schema 层面添加验证
```python
from pydantic import Field

class SkillDownloadRequest(BaseModel):
    skill_uuid: str  # UUID 格式验证
    version: str | None = Field(None, max_length=100)
```
