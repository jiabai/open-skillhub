import os
import tempfile
from pathlib import Path

from fastapi import UploadFile
from loguru import logger

from backend.core.middleware.logging import safe_log_context


UPLOAD_CHUNK_SIZE = 64 * 1024


async def stream_upload_to_temp_file(file: UploadFile, max_bytes: int) -> tuple[Path, int]:
    suffix = Path(file.filename or "").suffix or ".upload"
    total_size = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        try:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > max_bytes:
                    logger.bind(
                        **safe_log_context(filename=file.filename or "", total_size=total_size, max_bytes=max_bytes)
                    ).debug("Upload stream exceeded maximum size")
                    raise ValueError("File too large")
                temp_file.write(chunk)
        except Exception:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
            logger.bind(**safe_log_context(filename=file.filename or "", temp_path=str(temp_path))).debug(
                "Upload temp file removed after stream failure"
            )
            raise
    logger.bind(**safe_log_context(filename=file.filename or "", total_size=total_size, temp_path=str(temp_path))).debug(
        "Upload stream written to temp file"
    )
    return temp_path, total_size
