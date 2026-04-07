Bug #7: skill_uuid 格式未校验

位置:
- backend/schemas/skill_download.py:7 (Schema 定义)
- backend/api/v1/skills.py:285 (API 入口)

问题描述:

SkillDownloadRequest.skill_uuid 类型为 str，没有 UUID 格式验证。传入非 UUID 格式的字符串可能导致：
1. 数据库查询行为不一致（取决于 ORM 实现）
2. 不同报错信息可能暴露内部实现细节

```python
# 当前实现 - schemas/skill_download.py:6-8
class SkillDownloadRequest(BaseModel):
    skill_uuid: str  # ← 应该是 uuid.UUID 或带格式校验的 str
    version: str | None = None
```

对比其他接口可能存在的 UUID 校验（如 path parameter 的自动转换）。

复现步骤:

1. 发送 POST 请求到 /api/v1/skills/download
2. Body: { "skill_uuid": "not-a-valid-uuid; DROP TABLE skills;--", "version": "1.0.0" }
3. 观察 API 响应
4. 预期: 返回 400 Bad Request + "Invalid UUID format"
5. 实际: 可能返回 500 或暴露数据库查询错误信息

修复建议:

方案 A: 使用 Pydantic UUID 类型（推荐）
```python
from uuid import UUID

class SkillDownloadRequest(BaseModel):
    skill_uuid: UUID  # 自动校验 UUID 格式
    version: str | None = None
```

方案 B: 自定义 Validator（更灵活）
```python
from pydantic import field_validator
import re

class SkillDownloadRequest(BaseModel):
    skill_uuid: str
    version: str | None = None
    
    @field_validator('skill_uuid')
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        if not re.fullmatch(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[4][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}', v.strip()):
            raise ValueError('Invalid UUID format')
        return v.lower()  # 统一小写
    
    @field_validator('version')
    @classmethod
    def validate_version(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) > 100 or not re.fullmatch(r'[a-zA-Z0-9_\-\.]+', v):
                raise ValueError('Invalid version format')
            return v
        return v
```
