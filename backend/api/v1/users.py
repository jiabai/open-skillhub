from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.config.settings import settings
from backend.core.deps import require_management_access
from backend.core.middleware.auth import get_current_active_user
from backend.db.session import get_async_session
from backend.repositories.audit_log import AuditLogRepository
from backend.repositories.user import UserRepository
from backend.schemas.auth import UserIdentityUpdate
from backend.schemas.user import UserBindEmail, UserDeleteConfirm, UserListResponse, UserResponse, UserUpdate
from backend.services.audit import AuditService
from backend.services.user import UserService
from backend.services.verification_code import get_verification_service


router = APIRouter()

_verification_error_messages = {
    "CODE_EXPIRED": "验证码已过期",
    "CODE_INVALID": "验证码错误",
    "TOO_MANY_ATTEMPTS": "尝试次数过多，请稍后再试",
    "RESEND_TOO_FREQUENT": "重发过于频繁",
}


def _verification_error_payload(detail: str) -> dict | None:
    message = _verification_error_messages.get(detail)
    if not message:
        return None
    return {"detail": message, "code": detail}


@router.get("", response_model=UserListResponse)
async def list_users(
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    current_user=Depends(require_management_access()),
    session=Depends(get_async_session),
):
    user_repo = UserRepository(session)
    users = await user_repo.list_users(skip=skip, limit=limit, query=q)
    total = await user_repo.count_users(query=q)
    return UserListResponse(items=[UserResponse.model_validate(user) for user in users], total=total)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_active_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = UserService(UserRepository(session))
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return current_user
    updated = await service.update_user(current_user, **fields)
    return updated


@router.post("/me/delete-request", status_code=status.HTTP_204_NO_CONTENT)
async def request_delete_account(
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    verification_service = get_verification_service(session)
    await verification_service.send_code(current_user.email, "delete_account")
    return None


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    request: Request,
    payload: UserDeleteConfirm,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    verification_service = get_verification_service(session)
    try:
        await verification_service.verify_code(current_user.email, "delete_account", payload.code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    user_id = current_user.id
    service = UserService(UserRepository(session))
    await service.delete_user(current_user)
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=user_id,
            action="user.delete",
            target=user_id,
            ip=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return None


@router.post("/bind-email")
async def bind_email(
    payload: UserBindEmail,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    verification_service = get_verification_service(session)
    try:
        await verification_service.verify_code(payload.email, "bind_email", payload.code)
    except ValueError as exc:
        detail = str(exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_verification_error_payload(detail) or detail,
        ) from exc
    user_repo = UserRepository(session)
    existing = await user_repo.get_by_email(payload.email)
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    service = UserService(user_repo)
    await service.update_user(current_user, email=payload.email)
    return {"bound": True}


@router.put("/{user_id}/identity", response_model=UserResponse)
async def update_identity(
    request: Request,
    user_id: str,
    payload: UserIdentityUpdate,
    current_user=Depends(require_management_access()),
    session=Depends(get_async_session),
):
    user_repo = UserRepository(session)
    target = await user_repo.get_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    fields = payload.model_dump(exclude_unset=True)
    service = UserService(user_repo)
    updated = await service.update_user(target, **fields)
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="user.identity.update",
            target=target.id,
            ip=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata=fields,
        )
    return updated
