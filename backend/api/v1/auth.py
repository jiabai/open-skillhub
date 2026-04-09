from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
import secrets

from backend.config.settings import settings
from backend.core.middleware.auth import get_current_active_user
from backend.core.security.jwt_utils import decode_token
from backend.db.session import get_async_session
from backend.repositories.audit_log import AuditLogRepository
from backend.repositories.user import UserRepository
from backend.schemas.auth import LDAPLoginRequest, SSOLoginRequest
from backend.schemas.response import AccessTokenResponse, SSOPrepareResponse, TokenPair
from backend.schemas.token import TokenRefresh
from backend.schemas.user import UserLoginCode, UserRegisterCode
from backend.schemas.verification import VerificationCodeRequest, VerificationCodeResponse
from backend.services.audit import AuditService
from backend.services.auth import AuthService
from backend.services.sso_replay_guard import SSOReplayGuardService
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
        if not user:
            username = f"user_{secrets.token_hex(6)}"
            raw_password = secrets.token_urlsafe(24)
            user = await service.user_repo.create(
                email=payload.email,
                username=username,
                password=raw_password,
            )
        if not user.is_active:
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


@router.post("/sso/prepare", response_model=SSOPrepareResponse)
async def sso_prepare(session=Depends(get_async_session)):
    if not settings.ENABLE_SSO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SSO disabled")
    nonce, expires_in = await SSOReplayGuardService(session).issue_nonce()
    return SSOPrepareResponse(nonce=nonce, expires_in=expires_in)


@router.post("/sso/login", response_model=TokenPair)
async def sso_login(payload: SSOLoginRequest, session=Depends(get_async_session)):
    if not settings.ENABLE_SSO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SSO disabled")
    service = AuthService(UserRepository(session), SSOReplayGuardService(session))
    try:
        token_pair = await service.login_sso(payload.id_token, payload.nonce)
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
    Logout current user and revoke all previously issued JWTs for that user.
    """
    user_repo = UserRepository(session)
    await user_repo.update(
        current_user,
        jwt_token_version=current_user.jwt_token_version + 1,
    )
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(
            actor_id=current_user.id,
            action="auth.logout",
            target=current_user.id,
        )
    return None
