# Public Skill Sync CLI

## Purpose

This document records the stable contract for the host-side public skill sync command. The goal is to keep the operational behavior explicit so future changes do not accidentally reintroduce container-only assumptions or blur the difference between targeted import and full reconciliation.

## Stable Decisions

- The canonical skill name remains the directory name under `__system__`, not the `name` field inside `SKILL.md`.
- The script keeps one entry point and supports two modes:
  - full sync when no skill name is provided
  - targeted sync when a single skill name is provided
- Targeted sync updates only the requested skill and does not deactivate unrelated public skills.
- Full sync keeps the existing reconciliation behavior, including deactivating public skills that are no longer present on disk.
- The command accepts an explicit storage-root override so host-side preprod execution can point at a bind-mounted repository path instead of a container path.
- The command only mutates backend skill data; it does not toggle frontend visibility or runtime capabilities.

## Interface Contract

### Command shape

- `uv run python backend/scripts/sync_public_skills.py`
  - full sync
- `uv run python backend/scripts/sync_public_skills.py demo-skill`
  - targeted sync for one skill
- `uv run python backend/scripts/sync_public_skills.py demo-skill --storage-root ./data/skills`
  - targeted sync against a host-side preprod mount

### Storage resolution

- Default storage root comes from backend settings.
- `--storage-root` overrides the default root.
- The system directory is always resolved as `<storage-root>/__system__`.

### Error handling

- Invalid skill names fail fast before any filesystem work.
- Missing target directories or missing `SKILL.md` files are hard errors in targeted mode.
- Full sync keeps ignoring unrelated invalid directories under `__system__` and continues processing the remaining valid entries.

## Operational Notes

- Public Skills remain a backend-owned runtime capability.
- The frontend shows public skills only when the backend reports `public_skills=true`.
- Host-side execution is preferred for the preprod overlay because the repository already exposes `./data/skills` through bind mounts there.

