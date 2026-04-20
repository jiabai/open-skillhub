from __future__ import annotations

import json
from pathlib import Path

from backend.domain.user_status import DEFAULT_USER_STATUS, USER_STATUS_LABELS, USER_STATUS_VALUES
from scripts.sync_shared_catalogs import sync_user_status_catalog


ROOT = Path(__file__).resolve().parents[1]
SHARED_USER_STATUSES = ROOT / "shared" / "user-statuses.json"
BACKEND_USER_STATUSES = ROOT / "backend" / "domain" / "user-statuses.json"


def _load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def test_backend_user_status_catalog_matches_shared_source() -> None:
    shared_catalog = _load_json(SHARED_USER_STATUSES)
    backend_catalog = _load_json(BACKEND_USER_STATUSES)

    assert backend_catalog == shared_catalog
    assert tuple(shared_catalog["statuses"]) == USER_STATUS_VALUES
    assert shared_catalog["default"] == DEFAULT_USER_STATUS
    assert shared_catalog["labels"] == USER_STATUS_LABELS


def test_sync_user_status_catalog_check_and_write(tmp_path: Path) -> None:
    source_path = tmp_path / "shared" / "user-statuses.json"
    backend_target = tmp_path / "backend" / "domain" / "user-statuses.json"
    frontend_target = tmp_path / "frontend" / "src" / "generated" / "user-statuses.json"

    source_path.parent.mkdir(parents=True, exist_ok=True)
    backend_target.parent.mkdir(parents=True, exist_ok=True)
    frontend_target.parent.mkdir(parents=True, exist_ok=True)

    source_path.write_text(SHARED_USER_STATUSES.read_text(encoding="utf-8"), encoding="utf-8")
    backend_target.write_text('{"stale": true}\n', encoding="utf-8")
    frontend_target.write_text('{"stale": true}\n', encoding="utf-8")

    drifted = sync_user_status_catalog(source_path, (backend_target, frontend_target), write=False)
    assert drifted == [backend_target, frontend_target]

    sync_user_status_catalog(source_path, (backend_target, frontend_target), write=True)

    assert _load_json(backend_target) == _load_json(source_path)
    assert _load_json(frontend_target) == _load_json(source_path)
    assert sync_user_status_catalog(source_path, (backend_target, frontend_target), write=False) == []
