Bug #1: SKILL_DEACTIVATED 状态码处理不一致（语义错误）

标签: 已修复
修复说明: `backend/api/v1/skills.py` 的下载接口已对 `SKILL_DEACTIVATED` 返回 `410 Gone`，并补充了对应 API 回归测试。

位置:
- backend/api/v1/skills.py:292-293 (下载接口)
- 对比: backend/api/v1/skills.py:382-386 (diff 接口)
- 对比: backend/api/v1/skills.py:417-421 (install-instructions 接口)

问题描述:

下载接口将所有 ValueError 统一返回 404 Not Found，包括 SKILL_DEACTIVATED 错误。但其他接口（diff、install-instructions）对已停用 Skill 返回的是 410 Gone。

```python
# 下载接口 (skills.py:289-294) ← BUG 所在
try:
    result = await service.download_skill(current_user, payload.skill_uuid, payload.version)
except ValueError as exc:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    # ↑ 所有 ValueError 都是 404，包括 SKILL_DEACTIVATED ❌

# diff 接口 (skills.py:380-388) ← 正确实现
except ValueError as exc:
    if str(exc) == "SKILL_DEACTIVATED":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail={"detail": "Skill deactivated", "code": "SKILL_DEACTIVATED"},
        ) from exc
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
```

影响范围: 用户下载已停用的 Skill 时得到"资源不存在"(404)的误导信息，而非正确的"资源已失效"(410)。前端无法根据状态码做差异化处理。

复现步骤:

1. 创建一个 Skill 并上传文件
2. 调用 deactivate 接口停用该 Skill
3. 尝试调用 /api/v1/skills/download 下载该 Skill
4. 预期: 返回 410 Gone + SKILL_DEACTIVATED
5. 实际: 返回 404 Not Found + "SKILL_DEACTIVATED"

修复建议:

```python
@router.post("/download", response_model=SkillDownloadResponse)
async def download_skill(...):
    ...
    try:
        result = await service.download_skill(current_user, payload.skill_uuid, payload.version)
    except ValueError as exc:
        if str(exc) == "SKILL_DEACTIVATED":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={"detail": "Skill deactivated", "code": "SKILL_DEACTIVATED"},
            ) from exc
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ...
```
