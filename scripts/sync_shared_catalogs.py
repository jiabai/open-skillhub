"""同步共享目录中的 user-statuses.json 到后端和前端生成目录。

此脚本用于确保 shared/user-statuses.json 的变更能够自动同步到：
- backend/domain/user-statuses.json
- frontend/src/generated/user-statuses.json

用法：
  python scripts/sync_shared_catalogs.py --check   # 检查是否需要同步
  python scripts/sync_shared_catalogs.py --write   # 执行同步操作
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable, Sequence


REPO_ROOT = Path(__file__).resolve().parents[1]
USER_STATUS_SOURCE = REPO_ROOT / "shared" / "user-statuses.json"
USER_STATUS_TARGETS = (
    REPO_ROOT / "backend" / "domain" / "user-statuses.json",
    REPO_ROOT / "frontend" / "src" / "generated" / "user-statuses.json",
)


def _load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def _validate_user_status_catalog(catalog: object) -> dict[str, object]:
    if not isinstance(catalog, dict):
        raise ValueError("Catalog must be a JSON object")

    statuses = catalog.get("statuses")
    labels = catalog.get("labels")
    default = catalog.get("default")

    if not isinstance(default, str) or not default.strip():
        raise ValueError("Catalog default must be a non-empty string")
    if not isinstance(statuses, list) or not statuses or not all(isinstance(value, str) and value.strip() for value in statuses):
        raise ValueError("Catalog statuses must be a non-empty list of strings")
    if not isinstance(labels, dict) or not all(isinstance(key, str) and isinstance(value, str) for key, value in labels.items()):
        raise ValueError("Catalog labels must be an object of string keys and string values")

    normalized_statuses = [value.strip() for value in statuses]
    if len(set(normalized_statuses)) != len(normalized_statuses):
        raise ValueError("Catalog statuses must not contain duplicates")
    if default.strip() not in normalized_statuses:
        raise ValueError("Catalog default must be one of catalog statuses")
    if set(labels) != set(normalized_statuses):
        raise ValueError("Catalog labels must match catalog statuses exactly")

    return {
        "default": default.strip(),
        "statuses": normalized_statuses,
        "labels": {status: labels[status] for status in normalized_statuses},
    }


def _normalize_catalog_text(catalog: dict[str, object]) -> str:
    return json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"


def _iter_drifted_targets(expected_text: str, targets: Iterable[Path]) -> list[Path]:
    drifted: list[Path] = []
    for target in targets:
        if not target.exists() or target.read_text(encoding="utf-8") != expected_text:
            drifted.append(target)
    return drifted


def sync_user_status_catalog(
    source_path: Path = USER_STATUS_SOURCE,
    target_paths: Sequence[Path] = USER_STATUS_TARGETS,
    *,
    write: bool,
) -> list[Path]:
    catalog = _validate_user_status_catalog(_load_json(source_path))
    expected_text = _normalize_catalog_text(catalog)
    drifted = _iter_drifted_targets(expected_text, target_paths)

    if write:
        for target in target_paths:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(expected_text, encoding="utf-8")

    return drifted


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync generated catalog copies from shared JSON sources.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Fail if generated catalog copies are out of sync.")
    mode.add_argument("--write", action="store_true", help="Rewrite generated catalog copies from shared sources.")
    args = parser.parse_args(argv)

    drifted = sync_user_status_catalog(write=args.write)

    if args.write:
        print("Synced user status catalog:")
        for target in USER_STATUS_TARGETS:
            print(f"  - {target.relative_to(REPO_ROOT)}")
        return 0

    if drifted:
        print("Out-of-sync generated catalogs detected:", file=sys.stderr)
        for target in drifted:
            print(f"  - {target.relative_to(REPO_ROOT)}", file=sys.stderr)
        print("Run `python scripts/sync_shared_catalogs.py --write` to resync generated copies.", file=sys.stderr)
        return 1

    print("Shared catalogs are in sync.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
