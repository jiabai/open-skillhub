import re
from pathlib import Path

from loguru import logger

from backend.config.settings import settings
from backend.core.errors import build_tool_error_payload

ALLOWED_EXTENSIONS = {
    ".md", ".py", ".js", ".ts", ".sh", ".txt", ".json", ".yaml", ".yml",
    ".example", ".sample", ".template", ".cfg", ".ini", ".toml", ".env",
    ".xml", ".html", ".css", ".sql", ".csv", ".tsv",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".zip", ".tar", ".gz",
}
SAFE_FILENAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.]+$")
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_TOTAL_SIZE = 100 * 1024 * 1024
MAX_FILES_PER_SKILL = 50
SKILL_VERSIONS_DIRNAME = "_versions"
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"
SYSTEM_STORAGE_OWNER = "__system__"


def validate_skill_name(skill_name: str) -> tuple[bool, str]:
    if not skill_name or not skill_name.strip():
        return False, "Skill name cannot be empty"
    if len(skill_name) > 100:
        return False, "Skill name too long (max 100 characters)"
    if "/" in skill_name or "\\" in skill_name:
        return False, "Skill name cannot contain path separators"
    if ".." in skill_name or skill_name in {".", ".."}:
        return False, "Skill name contains invalid path component"
    if skill_name.startswith("."):
        return False, "Skill name cannot start with '.'"
    if not SAFE_FILENAME_PATTERN.match(skill_name):
        return False, "Skill name contains invalid characters"
    return True, "OK"


def tool_error_payload(detail: object, code: str) -> str:
    return build_tool_error_payload(detail=detail, code=code, ensure_ascii=False)


def resolve_storage_owner(user_id: str) -> str:
    return SYSTEM_STORAGE_OWNER if str(user_id) == SYSTEM_USER_ID else str(user_id)


def get_user_skill_dir(user_id: str, skill_name: str) -> Path:
    base = Path(settings.SKILL_STORAGE_PATH)
    return base / resolve_storage_owner(user_id) / skill_name


def get_skill_versions_dir(user_id: str, skill_name: str) -> Path:
    return get_user_skill_dir(user_id, skill_name) / SKILL_VERSIONS_DIRNAME


def clear_skill_current_dir(user_id: str, skill_name: str) -> None:
    path = get_user_skill_dir(user_id, skill_name)
    logger.debug(f"[STORAGE_CLEAR] user_id={user_id}, skill_name={skill_name}, path={path}")
    if not path.exists():
        logger.debug("[STORAGE_CLEAR] Directory does not exist")
        return
    versions_dir = path / SKILL_VERSIONS_DIRNAME
    for child in list(path.iterdir()):
        if child == versions_dir:
            continue
        _remove_path_tree(child)
    logger.debug("[STORAGE_CLEAR] Completed")


def create_skill_dir(user_id: str, skill_name: str) -> Path:
    path = get_user_skill_dir(user_id, skill_name)
    logger.debug(f"[STORAGE_CREATE_DIR] user_id={user_id}, skill_name={skill_name}, path={path}")
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_skill_dir(user_id: str, skill_name: str) -> None:
    path = get_user_skill_dir(user_id, skill_name)
    logger.debug(f"[STORAGE_DELETE_DIR] user_id={user_id}, skill_name={skill_name}, path={path}")
    if not path.exists():
        logger.debug("[STORAGE_DELETE_DIR] Directory does not exist")
        return
    _remove_path_tree(path)
    logger.debug("[STORAGE_DELETE_DIR] Completed")


def save_file(user_id: str, skill_name: str, filename: str, content: bytes) -> Path:
    path = create_skill_dir(user_id, skill_name)
    file_path = path / filename
    logger.debug(f"[STORAGE_SAVE_FILE] user_id={user_id}, skill_name={skill_name}, filename={filename}, content_size={len(content)} bytes")
    file_path.write_bytes(content)
    return file_path


def list_files(user_id: str, skill_name: str) -> list[str]:
    path = get_user_skill_dir(user_id, skill_name)
    if not path.exists():
        return []
    files = []
    for item in path.rglob("*"):
        if not item.is_file():
            continue
        rel_path = str(item.relative_to(path))
        if rel_path.startswith(SKILL_VERSIONS_DIRNAME) or f"/{SKILL_VERSIONS_DIRNAME}/" in rel_path.replace("\\", "/"):
            continue
        files.append(rel_path)
    return files


def skill_exists(user_id: str, skill_name: str) -> bool:
    return get_user_skill_dir(user_id, skill_name).exists()


def validate_filename(filename: str) -> tuple[bool, str]:
    if not filename or not filename.strip():
        return False, "Filename cannot be empty"
    if len(filename) > 255:
        return False, "Filename too long (max 255 characters)"
    if not SAFE_FILENAME_PATTERN.match(filename):
        return False, "Filename contains invalid characters"
    ext = Path(filename).suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        return False, f"File extension '{ext}' is not allowed"
    return True, "OK"


def validate_file_path(file_path: str) -> tuple[bool, str]:
    if not file_path or not file_path.strip():
        return False, "File path cannot be empty"
    if ".." in file_path:
        return False, "Path traversal detected: '..' is not allowed"
    if file_path.startswith("/") or (len(file_path) > 1 and file_path[1] == ":"):
        return False, "Absolute paths are not allowed"
    if "\\" in file_path:
        return False, "Backslashes are not allowed in file path"
    parts = file_path.split("/")
    for part in parts:
        if not part:
            continue
        if not SAFE_FILENAME_PATTERN.match(part):
            return False, f"Invalid filename component: '{part}'"
    ext = Path(file_path).suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        return False, f"File extension '{ext}' is not allowed"
    return True, "OK"


def get_safe_skill_path(base_dir: Path, user_id: str, skill_name: str, file_path: str) -> Path | None:
    base = base_dir / user_id / skill_name
    is_valid, _ = validate_file_path(file_path)
    if not is_valid:
        return None
    is_valid, _ = validate_skill_name(skill_name)
    if not is_valid:
        return None
    target = (base / file_path).resolve()
    base_resolved = base.resolve()
    if not target.is_relative_to(base_resolved):
        return None
    return target


def _remove_path_tree(path: Path) -> None:
    if path.is_file():
        path.unlink()
        return
    for child in path.rglob("*"):
        if child.is_file():
            child.unlink()
    for child in sorted(path.rglob("*"), reverse=True):
        if child.is_dir():
            child.rmdir()
    path.rmdir()
