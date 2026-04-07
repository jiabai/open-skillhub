Bug #2: 缺少通用异常处理（服务端 500 风险）

位置:
- backend/api/v1/skills.py:289-304 (下载接口)
- 对比: backend/api/v1/skills.py:256-261 (上传接口)

问题描述:

下载接口只捕获了 ValueError，未捕获其他可能的异常类型（数据库连接失败、文件系统 I/O 错误、序列化异常等）。这些异常会导致 FastAPI 返回默认的 500 Internal Server Error，可能泄露内部堆栈信息。

```python
# 当前实现 (有缺陷) - skills.py:289-294
try:
    result = await service.download_skill(current_user, payload.skill_uuid, payload.version)
except ValueError as exc:          # ← 只捕获 ValueError
    raise HTTPException(status_code=..., detail=str(exc)) from exc
# ↑ 其他异常直接穿透到 FastAPI 默认处理器 ❌

# 对比上传接口的正确实现 - skills.py:256-261
except ValueError as exc:
    logger.error(...)
    raise HTTPException(400, ...) from exc
except Exception as exc:           # ← 兜底捕获所有异常
    logger.error("unexpected_error", ..., exc_info=True)
    raise HTTPException(500, "Upload failed") from exc
```

影响范围:
- 数据库连接超时 → 500 + 可能暴露 DB 连接字符串
- 文件系统权限错误 → 500 + 暴露服务器路径
- 序列化错误 → 500 + 暴露内部数据结构

复现步骤:

1. 在下载过程中模拟数据库断开或文件系统权限不足
2. 调用 /api/v1/skills/download 接口
3. 预期: 返回 500 + 安全的错误消息 "Download failed"
4. 实际: 返回 500 + 可能包含堆栈跟踪、数据库查询、服务器路径等敏感信息

修复建议:

```python
@router.post("/download", response_model=SkillDownloadResponse)
async def download_skill(request, payload, current_user, session):
    service = SkillService(SkillRepository(session), SkillVersionRepository(session))
    try:
        result = await service.download_skill(current_user, payload.skill_uuid, payload.version)
    except ValueError as exc:
        if str(exc) == "SKILL_DEACTIVATED":
            raise HTTPException(status_code=status.HTTP_410_GONE, detail={"detail": "Skill deactivated", "code": "SKILL_DEACTIVATED"}) from exc
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(f"[DOWNLOAD FAILED] user_id={current_user.id}, skill={payload.skill_uuid}, error={str(exc)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Download failed") from exc
    
    response_payload = SkillDownloadResponse.model_validate(result)
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="skill.download",
            target=payload.skill_uuid,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return response_payload
```
