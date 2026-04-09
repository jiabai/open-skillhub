from enum import StrEnum


class SkillErrorCode(StrEnum):
    DOWNLOAD_TOO_LARGE = "DOWNLOAD_TOO_LARGE"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    INVALID_FILE_PATH = "INVALID_FILE_PATH"
    INVALID_FILENAME = "INVALID_FILENAME"
    INVALID_METADATA = "INVALID_METADATA"
    INVALID_SKILL_NAME = "INVALID_SKILL_NAME"
    INVALID_VERSION = "INVALID_VERSION"
    INVALID_VISIBILITY = "INVALID_VISIBILITY"
    INVALID_ZIP_FILE = "INVALID_ZIP_FILE"
    PUBLIC_SKILLS_DISABLED = "PUBLIC_SKILLS_DISABLED"
    REFERENCE_ALREADY_EXISTS = "REFERENCE_ALREADY_EXISTS"
    REFERENCE_SKILL_READ_ONLY = "REFERENCE_SKILL_READ_ONLY"
    SKILL_ALREADY_EXISTS = "SKILL_ALREADY_EXISTS"
    SKILL_DEACTIVATED = "SKILL_DEACTIVATED"
    SKILL_MD_NAME_MISSING = "SKILL_MD_NAME_MISSING"
    SKILL_MD_NOT_FOUND = "SKILL_MD_NOT_FOUND"
    SKILL_MD_NOT_FOUND_IN_ZIP = "SKILL_MD_NOT_FOUND_IN_ZIP"
    SKILL_NOT_FOUND = "SKILL_NOT_FOUND"
    SOURCE_SKILL_UNAVAILABLE = "SOURCE_SKILL_UNAVAILABLE"
    TOO_MANY_FILES = "TOO_MANY_FILES"
    TOTAL_SKILL_SIZE_LIMIT_EXCEEDED = "TOTAL_SKILL_SIZE_LIMIT_EXCEEDED"
    VERSION_ALREADY_EXISTS = "VERSION_ALREADY_EXISTS"
    VERSION_FILES_NOT_FOUND = "VERSION_FILES_NOT_FOUND"
    VERSION_NOT_FOUND = "VERSION_NOT_FOUND"
    VERSION_REPOSITORY_NOT_CONFIGURED = "VERSION_REPOSITORY_NOT_CONFIGURED"
    ZIP_EMPTY = "ZIP_EMPTY"


_DEFAULT_MESSAGES: dict[SkillErrorCode, str] = {
    SkillErrorCode.DOWNLOAD_TOO_LARGE: "Download too large",
    SkillErrorCode.FILE_NOT_FOUND: "File not found",
    SkillErrorCode.FILE_TOO_LARGE: "File too large",
    SkillErrorCode.INVALID_FILE_PATH: "Invalid file path",
    SkillErrorCode.INVALID_FILENAME: "Filename contains invalid characters",
    SkillErrorCode.INVALID_METADATA: "Invalid metadata",
    SkillErrorCode.INVALID_SKILL_NAME: "Invalid skill name",
    SkillErrorCode.INVALID_VERSION: "Invalid version",
    SkillErrorCode.INVALID_VISIBILITY: "Invalid visibility",
    SkillErrorCode.INVALID_ZIP_FILE: "Invalid zip file",
    SkillErrorCode.PUBLIC_SKILLS_DISABLED: "Public skills disabled",
    SkillErrorCode.REFERENCE_ALREADY_EXISTS: "Reference skill already exists",
    SkillErrorCode.REFERENCE_SKILL_READ_ONLY: "Reference skill is read only",
    SkillErrorCode.SKILL_ALREADY_EXISTS: "Skill already exists",
    SkillErrorCode.SKILL_DEACTIVATED: "Skill deactivated",
    SkillErrorCode.SKILL_MD_NAME_MISSING: "Skill name not found in SKILL.md frontmatter",
    SkillErrorCode.SKILL_MD_NOT_FOUND: "SKILL.md not found",
    SkillErrorCode.SKILL_MD_NOT_FOUND_IN_ZIP: "SKILL.md not found in zip",
    SkillErrorCode.SKILL_NOT_FOUND: "Skill not found",
    SkillErrorCode.SOURCE_SKILL_UNAVAILABLE: "Source skill unavailable",
    SkillErrorCode.TOO_MANY_FILES: "Too many files in skill",
    SkillErrorCode.TOTAL_SKILL_SIZE_LIMIT_EXCEEDED: "Total skill size limit exceeded",
    SkillErrorCode.VERSION_ALREADY_EXISTS: "Version already exists",
    SkillErrorCode.VERSION_FILES_NOT_FOUND: "Version files not found",
    SkillErrorCode.VERSION_NOT_FOUND: "Version not found",
    SkillErrorCode.VERSION_REPOSITORY_NOT_CONFIGURED: "Version repository not configured",
    SkillErrorCode.ZIP_EMPTY: "Zip is empty",
}


class SkillError(ValueError):
    def __init__(self, code: SkillErrorCode, detail: str | None = None):
        self.code = code
        self.detail = detail or _DEFAULT_MESSAGES[code]
        super().__init__(f"{self.code.value}: {self.detail}")


class DownloadTooLargeError(SkillError):
    def __init__(self, size_bytes: int, limit_bytes: int):
        super().__init__(SkillErrorCode.DOWNLOAD_TOO_LARGE)
        self.size_bytes = size_bytes
        self.limit_bytes = limit_bytes
