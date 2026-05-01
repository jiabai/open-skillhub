# Design Docs Index

## Purpose

This directory stores durable design decisions, architecture notes, and review findings that are useful beyond a single task run.

## Current Documents

| File | Purpose |
|------|---------|
| `core-beliefs.md` | Stable engineering principles for the repository |
| `2026-04-12-code-review-findings.md` | Consolidated list of still-valid code review issues |
| `execution-gates-adoption.md` | Rationale and rollout notes for the repository execution gates |
| `public-skill-auto-version-upgrade.md` | Public skill root snapshot change detection and automatic patch version creation |
| `public-skill-sync-cli.md` | Stable contract for the host-side public skill sync command |

## How To Use This Directory

- Put cross-cutting design decisions here.
- Do not store step-by-step implementation logs here; those belong in `docs/exec-plans/`.
- Keep filenames descriptive and stable so other docs can reference them.
