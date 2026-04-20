from fastapi import HTTPException, status

from backend.services.skill_errors import SkillError, SkillErrorCode


_SKILL_ERROR_RESPONSES: dict[SkillErrorCode, tuple[int, bool]] = {
    SkillErrorCode.SKILL_DEACTIVATED: (status.HTTP_410_GONE, True),
    SkillErrorCode.PUBLIC_SKILLS_DISABLED: (status.HTTP_404_NOT_FOUND, True),
    SkillErrorCode.PUBLIC_SKILL_DOWNLOAD_REQUIRES_REFERENCE_OR_CLONE: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.PUBLIC_SKILL_EXECUTION_REQUIRES_REFERENCE_OR_CLONE: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.SKILL_NOT_FOUND: (status.HTTP_404_NOT_FOUND, True),
    SkillErrorCode.FILE_NOT_FOUND: (status.HTTP_404_NOT_FOUND, False),
    SkillErrorCode.VERSION_FILES_NOT_FOUND: (status.HTTP_404_NOT_FOUND, False),
    SkillErrorCode.REFERENCE_SKILL_READ_ONLY: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.REFERENCE_ALREADY_EXISTS: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.SOURCE_SKILL_UNAVAILABLE: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.SKILL_ALREADY_EXISTS: (status.HTTP_409_CONFLICT, True),
    SkillErrorCode.INVALID_FILENAME: (status.HTTP_400_BAD_REQUEST, True),
    SkillErrorCode.INVALID_FILE_PATH: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_METADATA: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_SKILL_NAME: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_VERSION: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_VISIBILITY: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.INVALID_ZIP_FILE: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.SKILL_MD_NAME_MISSING: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.SKILL_MD_NOT_FOUND: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.SKILL_MD_NOT_FOUND_IN_ZIP: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.TOO_MANY_FILES: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.TOTAL_SKILL_SIZE_LIMIT_EXCEEDED: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.VERSION_ALREADY_EXISTS: (status.HTTP_400_BAD_REQUEST, False),
    SkillErrorCode.VERSION_NOT_FOUND: (status.HTTP_404_NOT_FOUND, True),
    SkillErrorCode.ZIP_EMPTY: (status.HTTP_400_BAD_REQUEST, False),
}


def _build_http_exception(status_code: int, detail: str, code: str | None = None, structured: bool = False) -> HTTPException:
    if structured and code:
        return HTTPException(status_code=status_code, detail={"detail": detail, "code": code})
    return HTTPException(status_code=status_code, detail=detail)


def _handle_legacy_skill_value_error(detail: str) -> HTTPException | None:
    # Compat path for older service methods that still raise raw ValueError strings.
    if "Filename contains invalid characters" in detail:
        return _build_http_exception(
            status.HTTP_400_BAD_REQUEST,
            detail,
            code=SkillErrorCode.INVALID_FILENAME.value,
            structured=True,
        )
    if detail == "File too large":
        return _build_http_exception(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "File exceeds maximum size limit",
            code=SkillErrorCode.FILE_TOO_LARGE.value,
            structured=True,
        )
    if detail == "Skill already exists":
        return _build_http_exception(
            status.HTTP_409_CONFLICT,
            detail,
            code=SkillErrorCode.SKILL_ALREADY_EXISTS.value,
            structured=True,
        )
    if detail == "Version not found":
        return _build_http_exception(
            status.HTTP_404_NOT_FOUND,
            detail,
            code=SkillErrorCode.VERSION_NOT_FOUND.value,
            structured=True,
        )
    if detail in {"File not found", "Version files not found"}:
        return _build_http_exception(status.HTTP_404_NOT_FOUND, detail)
    return None


def handle_skill_value_error(exc: ValueError) -> HTTPException:
    if isinstance(exc, SkillError):
        if exc.code == SkillErrorCode.FILE_TOO_LARGE:
            return _build_http_exception(
                status.HTTP_413_CONTENT_TOO_LARGE,
                "File exceeds maximum size limit",
                code=SkillErrorCode.FILE_TOO_LARGE.value,
                structured=True,
            )
        status_code, structured = _SKILL_ERROR_RESPONSES.get(exc.code, (status.HTTP_400_BAD_REQUEST, False))
        return _build_http_exception(status_code, exc.detail, code=exc.code.value, structured=structured)

    detail = str(exc)
    legacy_exception = _handle_legacy_skill_value_error(detail)
    if legacy_exception is not None:
        return legacy_exception
    if detail == "Invalid visibility":
        return _build_http_exception(status.HTTP_400_BAD_REQUEST, detail)
    return _build_http_exception(status.HTTP_400_BAD_REQUEST, detail)
