#!/usr/bin/env python3
"""One-time SQLite helper to promote a single user to superuser.

Safety features:
- refuses non-SQLite database URLs
- requires exactly one identifier
- creates a timestamped backup before writing
- asks for an explicit confirmation unless --yes is passed
- bumps jwt_token_version when present so stale tokens stop working
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.engine import make_url


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = REPO_ROOT / "backend" / ".env"


def read_database_url_from_env_file(path: Path) -> str | None:
    if not path.exists():
        return None

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == "DATABASE_URL":
            return value.strip().strip('"').strip("'")
    return None


def resolve_database_url(override: str | None) -> str:
    if override:
        return override.strip()

    env_url = os.environ.get("DATABASE_URL", "").strip()
    if env_url:
        return env_url

    file_url = read_database_url_from_env_file(DEFAULT_ENV_FILE)
    if file_url:
        return file_url

    raise ValueError("DATABASE_URL not found. Pass --db-url or set DATABASE_URL.")


def resolve_sqlite_path(db_url: str) -> Path:
    url = make_url(db_url)
    if not url.drivername.startswith("sqlite"):
        raise ValueError(f"Only SQLite URLs are supported, got {url.drivername!r}")

    raw_database = url.database
    if not raw_database or raw_database == ":memory:":
        raise ValueError("SQLite database URL must point to a file on disk")

    db_path = Path(raw_database)
    if not db_path.is_absolute():
        db_path = (REPO_ROOT / db_path).resolve()
    return db_path


def select_identifier(args: argparse.Namespace) -> tuple[str, str]:
    candidates = [
        ("id", args.user_id),
        ("email", args.email),
        ("username", args.username),
    ]
    selected = [(field, value.strip()) for field, value in candidates if value and value.strip()]
    if len(selected) != 1:
        raise ValueError("Pass exactly one of --user-id, --email, or --username.")
    return selected[0]


def table_columns(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("PRAGMA table_info(users)").fetchall()
    return {str(row[1]) for row in rows}


def format_user_row(row: sqlite3.Row) -> str:
    parts = [
        f"id={row['id']}",
        f"email={row['email']}",
        f"username={row['username']}",
        f"is_superuser={bool(row['is_superuser'])}",
    ]
    if "jwt_token_version" in row.keys():
        parts.append(f"jwt_token_version={row['jwt_token_version']}")
    if "updated_at" in row.keys():
        parts.append(f"updated_at={row['updated_at']}")
    return ", ".join(parts)


def build_update_sql(columns: set[str], identifier_field: str) -> str:
    assignments = ["is_superuser = 1"]
    if "jwt_token_version" in columns:
        assignments.append("jwt_token_version = COALESCE(jwt_token_version, 0) + 1")
    if "updated_at" in columns:
        assignments.append("updated_at = CURRENT_TIMESTAMP")
    return f"UPDATE users SET {', '.join(assignments)} WHERE {identifier_field} = ?"


def backup_database(db_path: Path) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_path = db_path.with_name(f"{db_path.name}.bak-{timestamp}")
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(db_path, backup_path)
    return backup_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Promote one SQLite user to superuser with a backup and confirmation prompt."
    )
    parser.add_argument("--db-url", help="Override DATABASE_URL.")
    parser.add_argument("--user-id", help="Target user id.")
    parser.add_argument("--email", help="Target email address.")
    parser.add_argument("--username", help="Target username.")
    parser.add_argument("--yes", action="store_true", help="Skip the interactive confirmation prompt.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing.")
    args = parser.parse_args(argv)

    try:
        identifier_field, identifier_value = select_identifier(args)
        database_url = resolve_database_url(args.db_url)
        db_path = resolve_sqlite_path(database_url)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if not db_path.exists():
        print(f"error: database file does not exist: {db_path}", file=sys.stderr)
        return 1

    try:
        with sqlite3.connect(str(db_path)) as conn:
            conn.row_factory = sqlite3.Row
            columns = table_columns(conn)
            required_columns = {"id", "email", "username", "is_superuser"}
            missing = required_columns - columns
            if missing:
                print(f"error: users table is missing columns: {', '.join(sorted(missing))}", file=sys.stderr)
                return 1

            row = conn.execute(
                f"SELECT * FROM users WHERE {identifier_field} = ?",
                (identifier_value,),
            ).fetchall()
            if not row:
                print(
                    f"error: no user found for {identifier_field}={identifier_value!r}",
                    file=sys.stderr,
                )
                return 1
            if len(row) > 1:
                print(
                    f"error: multiple users matched {identifier_field}={identifier_value!r}; aborting",
                    file=sys.stderr,
                )
                return 1

            current_user = row[0]
            print("Matched user:")
            print(f"  {format_user_row(current_user)}")

            if bool(current_user["is_superuser"]):
                print("User is already a superuser. No changes made.")
                return 0

            print()
            print("Planned change:")
            print("  - set is_superuser = 1")
            if "jwt_token_version" in columns:
                print("  - increment jwt_token_version to invalidate existing JWT sessions")
            if "updated_at" in columns:
                print("  - refresh updated_at")

            if not args.yes:
                expected = identifier_value
                confirmation = input(f"Type {expected!r} to confirm: ").strip()
                if confirmation != expected:
                    print("Confirmation did not match. Aborting.", file=sys.stderr)
                    return 1

            if args.dry_run:
                print("Dry run requested. No changes were written.")
                return 0

            backup_path = backup_database(db_path)
            print(f"Backup created at: {backup_path}")

            conn.execute("BEGIN IMMEDIATE")
            update_sql = build_update_sql(columns, identifier_field)
            result = conn.execute(update_sql, (identifier_value,))
            if result.rowcount != 1:
                conn.rollback()
                print("error: update did not affect exactly one row", file=sys.stderr)
                return 1
            conn.commit()

            refreshed = conn.execute(
                f"SELECT * FROM users WHERE {identifier_field} = ?",
                (identifier_value,),
            ).fetchone()
            if refreshed is not None:
                print("Updated user:")
                print(f"  {format_user_row(refreshed)}")

    except KeyboardInterrupt:
        print("\nInterrupted.")
        return 130
    except sqlite3.Error as exc:
        print(f"error: sqlite failure: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print()
    print("Done. Re-login with this account to pick up the new superuser flag.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
