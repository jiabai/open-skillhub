import hashlib
from pathlib import Path

EXCLUDED_NAMES = {".DS_Store", "Thumbs.db"}

def compute_skill_content_hash(version_dir: Path) -> str:
    entries: list[tuple[str, bytes]] = []
    for file_path in version_dir.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.name in EXCLUDED_NAMES:
            continue
        if "__MACOSX" in file_path.parts:
            continue
        relative = file_path.relative_to(version_dir).as_posix()
        entries.append((relative, file_path.read_bytes()))

    hasher = hashlib.sha256()
    for relative, content in sorted(entries, key=lambda entry: entry[0]):
        hasher.update(f"{relative}\0".encode("utf-8"))
        hasher.update(content)
        hasher.update(b"\0")

    return hasher.hexdigest()
