from fastapi import APIRouter, Depends, HTTPException, Request, status

from skillhub.config.settings import settings
from skillhub.core.middleware.auth import get_current_active_user
from skillhub.db.session import get_async_session
from skillhub.repositories.audit_log import AuditLogRepository
from skillhub.repositories.token import TokenRepository
from skillhub.repositories.user import UserRepository
from skillhub.schemas.token import TokenCreate, TokenListResponse, TokenResponse
from skillhub.services.audit import AuditService
from skillhub.services.token import TokenService


router = APIRouter()


@router.get("", response_model=TokenListResponse, response_model_exclude_none=True)
@router.get("/", response_model=TokenListResponse, response_model_exclude_none=True)
async def list_tokens(
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = TokenService(TokenRepository(session), UserRepository(session))
    tokens = await service.token_repo.list_by_user(current_user.id, skip=skip, limit=limit)
    total = await service.token_repo.count_by_user(current_user.id)
    return TokenListResponse(
        items=[TokenResponse.model_validate(token) for token in tokens],
        total=total,
    )


@router.post("", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def create_token(
    request: Request,
    payload: TokenCreate,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = TokenService(TokenRepository(session), UserRepository(session))
    token, value = await service.create_token_with_value(
        current_user,
        name=payload.name,
        expires_at=payload.expires_at,
    )
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="token.create",
            target=token.id,
            ip=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={"name": payload.name},
        )
    response = TokenResponse.model_validate(token)
    response.token = value
    return response


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_token(
    request: Request,
    token_id: str,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    service = TokenService(TokenRepository(session), UserRepository(session))
    try:
        await service.revoke_token(current_user, token_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="token.revoke",
            target=token_id,
            ip=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )
    return None
