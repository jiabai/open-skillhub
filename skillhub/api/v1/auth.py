from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from skillhub.config.settings import settings
from skillhub.core.middleware.auth import get_current_active_user
from skillhub.core.security.jwt_utils import decode_token
from skillhub.db.session import get_async_session
from skillhub.repositories.audit_log import AuditLogRepository
from skillhub.repositories.user import UserRepository
from skillhub.schemas.auth import LDAPLoginRequest, SSOLoginRequest
from skillhub.schemas.response import AccessTokenResponse, TokenPair
from skillhub.schemas.token import TokenRefresh
from skillhub.schemas.user import UserLoginCode, UserRegisterCode
from skillhub.schemas.verification import VerificationCodeRequest, VerificationCodeResponse
from skillhub.services.audit import AuditService
from skillhub.services.auth import AuthService
from skillhub.services.verification_code import get_verification_service


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


@router.post("/verification-code", response_model=VerificationCodeResponse)
async def send_verification_code(
    request: Request,
    payload: VerificationCodeRequest,
    background_tasks: BackgroundTasks,
    session=Depends(get_async_session),
):
    if not settings.ENABLE_EMAIL_OTP_LOGIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email OTP disabled")
    service = get_verification_service(session)
    try:
        response = await service.send_code(payload.email, payload.purpose, schedule=background_tasks.add_task)
    except ValueError as exc:
        detail = str(exc)
        if detail == "RESEND_TOO_FREQUENT":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=_verification_error_payload(detail) or detail,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_verification_error_payload(detail) or detail,
        ) from exc
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id="anonymous",
            action="auth.verification_code.send",
            target=payload.email,
            ip=request.client.host if request and request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata={"purpose": payload.purpose},
        )
    return response


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegisterCode, session=Depends(get_async_session)):
    if not settings.ENABLE_PUBLIC_SIGNUP:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Signup disabled")
    verification_service = get_verification_service(session)
    service = AuthService(UserRepository(session))
    try:
        await verification_service.verify_code(payload.email, "register", payload.code)
        user = await service.register(
            email=payload.email,
            username=payload.username,
            password=None,
        )
    except ValueError as exc:
        detail = str(exc)
        if "already" in detail.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_verification_error_payload(detail) or detail,
        ) from exc
    token_pair = service.issue_token(user)
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(actor_id=user.id, action="auth.register", target=user.id)
    return TokenPair(access_token=token_pair.access_token, refresh_token=token_pair.refresh_token)


@router.post("/login", response_model=TokenPair)
async def login(payload: UserLoginCode, session=Depends(get_async_session)):
    if not settings.ENABLE_EMAIL_OTP_LOGIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email OTP disabled")
    verification_service = get_verification_service(session)
    service = AuthService(UserRepository(session))
    try:
        await verification_service.verify_code(payload.email, "login", payload.code)
        user = await service.user_repo.get_by_email(payload.email)
        if not user or not user.is_active:
            raise ValueError("Invalid credentials")
    except ValueError as exc:
        detail = str(exc)
        if settings.ENABLE_AUDIT_LOG:
            audit_service = AuditService(AuditLogRepository(session))
            await audit_service.create_event(
                actor_id="anonymous",
                action="auth.login.failed",
                target=payload.email,
                result="failed",
                metadata={"detail": detail},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_verification_error_payload(detail) or detail,
        ) from exc
    token_pair = service.issue_token(user)
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(actor_id=user.id, action="auth.login", target=user.id)
    return TokenPair(access_token=token_pair.access_token, refresh_token=token_pair.refresh_token)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(payload: TokenRefresh, session=Depends(get_async_session)):
    service = AuthService(UserRepository(session))
    target = "unknown"
    try:
        target = str(decode_token(payload.refresh_token).get("sub") or "") or "unknown"
    except Exception:
        target = "unknown"
    try:
        token_pair = await service.refresh_token(payload.refresh_token)
    except ValueError as exc:
        if settings.ENABLE_AUDIT_LOG:
            audit_service = AuditService(AuditLogRepository(session))
            await audit_service.create_event(
                actor_id=target,
                action="auth.refresh.failed",
                target=target,
                result="failed",
                metadata={"detail": str(exc)},
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        if target == "unknown":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(actor_id=target, action="auth.refresh", target=target)
    return AccessTokenResponse(access_token=token_pair.access_token)


@router.post("/sso/login", response_model=TokenPair)
async def sso_login(payload: SSOLoginRequest, session=Depends(get_async_session)):
    if not settings.ENABLE_SSO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SSO disabled")
    service = AuthService(UserRepository(session))
    try:
        token_pair = await service.login_sso(payload.id_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        user_id = str(decode_token(token_pair.access_token).get("sub") or "")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(actor_id=user_id, action="auth.sso.login", target=user_id)
    return TokenPair(access_token=token_pair.access_token, refresh_token=token_pair.refresh_token)


@router.post("/ldap/login", response_model=TokenPair)
async def ldap_login(payload: LDAPLoginRequest, session=Depends(get_async_session)):
    if not settings.ENABLE_LDAP:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="LDAP disabled")
    service = AuthService(UserRepository(session))
    try:
        token_pair = await service.login_ldap(payload.username, payload.password)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if settings.ENABLE_AUDIT_LOG:
        user_id = str(decode_token(token_pair.access_token).get("sub") or "")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(actor_id=user_id, action="auth.ldap.login", target=user_id)
    return TokenPair(access_token=token_pair.access_token, refresh_token=token_pair.refresh_token)

@router.post("/logout")
async def logout(
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    """
    Logout current user.
    Note: JWT tokens cannot be invalidated server-side, this is mainly for audit logging.
    """
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="auth.logout",
            target=current_user.id,
        )
    return None

