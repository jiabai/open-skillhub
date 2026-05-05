from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
import secrets
from urllib.parse import urlencode, urlsplit, urlunsplit

from backend.config.settings import settings
from backend.core.errors import VerificationError, build_http_error_detail
from backend.core.middleware.auth import get_current_active_user
from backend.core.security.jwt_utils import decode_token
from backend.db.session import get_async_session
from backend.repositories.audit_log import AuditLogRepository
from backend.repositories.user import UserRepository
from backend.schemas.auth import LDAPLoginRequest
from backend.schemas.response import TokenPair
from backend.schemas.token import TokenRefresh
from backend.schemas.user import UserLoginCode, UserRegisterCode
from backend.schemas.verification import VerificationCodeRequest, VerificationCodeResponse
from backend.services.audit import AuditService
from backend.services.auth import AuthService
from backend.services.sso_oidc import SSOOIDCService
from backend.services.sso_replay_guard import SSOReplayGuardService
from backend.services.verification_code import get_verification_service


router = APIRouter()


def _frontend_callback_url(*, fragment: dict[str, str] | None = None, query: dict[str, str] | None = None) -> str:
    base_url = str(settings.SSO_FRONTEND_CALLBACK_URL or "").strip()
    if not base_url:
        raise ValueError("SSO configuration incomplete: SSO_FRONTEND_CALLBACK_URL")
    split = urlsplit(base_url)
    query_string = urlencode(query or {})
    fragment_string = urlencode(fragment or {})
    return urlunsplit((split.scheme, split.netloc, split.path, query_string, fragment_string))


def _redirect_frontend_error(detail: str, status_code: int = status.HTTP_302_FOUND) -> RedirectResponse:
    return RedirectResponse(
        url=_frontend_callback_url(query={"error": "sso_error", "error_description": detail}),
        status_code=status_code,
    )


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
    except VerificationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=build_http_error_detail(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
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
    except VerificationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=build_http_error_detail(exc),
        ) from exc
    except ValueError as exc:
        detail = str(exc)
        if "already" in detail.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
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
            if not settings.ENABLE_PUBLIC_SIGNUP:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Signup disabled")
            username = f"user_{secrets.token_hex(6)}"
            raw_password = secrets.token_urlsafe(24)
            user = await service.user_repo.create(
                email=payload.email,
                username=username,
                password=raw_password,
            )
        service._assert_user_enabled(user)
    except HTTPException:
        raise
    except VerificationError as exc:
        if settings.ENABLE_AUDIT_LOG:
            audit_service = AuditService(AuditLogRepository(session))
            await audit_service.create_event(
                actor_id="anonymous",
                action="auth.login.failed",
                target=payload.email,
                result="failed",
                metadata={"detail": exc.code},
            )
        raise HTTPException(
            status_code=exc.status_code,
            detail=build_http_error_detail(exc),
        ) from exc
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
            detail=detail,
        ) from exc
    token_pair = service.issue_token(user)
    if settings.ENABLE_AUDIT_LOG:
        audit_service = AuditService(AuditLogRepository(session))
        await audit_service.create_event(actor_id=user.id, action="auth.login", target=user.id)
    return TokenPair(access_token=token_pair.access_token, refresh_token=token_pair.refresh_token)


@router.post("/refresh", response_model=TokenPair)
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
    return TokenPair(access_token=token_pair.access_token, refresh_token=token_pair.refresh_token)


@router.get("/sso/authorize")
async def sso_authorize(session=Depends(get_async_session)):
    if not settings.ENABLE_SSO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SSO disabled")
    oidc_service = SSOOIDCService()
    try:
        oidc_service.validate_configuration()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    replay_guard = SSOReplayGuardService(session)
    state, nonce, code_verifier, _expires_in = await replay_guard.issue_auth_request(settings.SSO_REDIRECT_URI)
    url = oidc_service.build_authorization_url(
        state=state,
        nonce=nonce,
        code_challenge=replay_guard.build_code_challenge(code_verifier),
    )
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.get("/sso/callback")
async def sso_callback(
    request: Request,
    code: str | None = None,
    state_param: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    session=Depends(get_async_session),
):
    if not settings.ENABLE_SSO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SSO disabled")
    if error:
        return _redirect_frontend_error(error_description or error)
    if not code:
        return _redirect_frontend_error("Missing authorization code")
    state_value = state_param or ""
    if request is not None and not state_value:
        state_value = str(request.query_params.get("state") or "")
    if not state_value:
        return _redirect_frontend_error("Missing state")

    replay_guard = SSOReplayGuardService(session)
    oidc_service = SSOOIDCService()
    try:
        auth_request = await replay_guard.consume_auth_request(state_value)
        token_payload = await oidc_service.exchange_code_for_tokens(code, auth_request.code_verifier)
        id_token = str(token_payload.get("id_token") or "").strip()
        payload = await oidc_service.decode_id_token(id_token)
        token_nonce = str(payload.get("nonce") or "").strip()
        replay_guard.verify_auth_request_nonce(auth_request, token_nonce)
        expires_at = oidc_service.validate_nonce_and_timestamps(payload, expected_nonce=token_nonce)
        replay_key = str(payload.get("jti") or "").strip() or token_payload.get("access_token") or id_token
        auth_service = AuthService(UserRepository(session), replay_guard)
        token_pair = await auth_service.login_sso_claims(
            payload,
            replay_key=str(replay_key),
            expires_at=expires_at,
        )
        if settings.ENABLE_AUDIT_LOG:
            user_id = str(decode_token(token_pair.access_token).get("sub") or "")
            if user_id:
                audit_service = AuditService(AuditLogRepository(session))
                await audit_service.create_event(actor_id=user_id, action="auth.sso.login", target=user_id)
    except ValueError as exc:
        return _redirect_frontend_error(str(exc))
    except Exception as exc:
        return _redirect_frontend_error(str(exc))

    return RedirectResponse(
        url=_frontend_callback_url(
            fragment={
                "access_token": token_pair.access_token,
                "refresh_token": token_pair.refresh_token,
            }
        ),
        status_code=status.HTTP_302_FOUND,
    )


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
