# Product Specs Index

## Purpose

Product specs describe user-visible intent and boundaries for a feature before or alongside implementation work.

## Current Specs

| File | Scope |
|------|-------|
| `2026-04-14-frontend-i18n.md` | Initial frontend i18n boundary and first migration batch |
| `2026-04-18-invitation-code.md` | Invitation code registration and admin management backend |
| `2026-04-22-public-skill-import-cli.md` | Host-side single-skill import workflow for the public Skills catalog |
| `2026-04-24-client-skills-private-space.md` | Client API skill listing semantics: only user-owned private-space skills, including reference/clone records |
| `2026-05-01-client-skills-upload.md` | Client API ZIP skill upload endpoint: API-token-only skill creation and version append |
| `2026-05-02-landing-page-light-mode.md` | Public light-mode Landing Page intent, Shell boundary, copy, and visual acceptance criteria |
| `2026-05-04-content-hash-dedup.md` | Content hash dedup for skill distribution: replace version-string comparison with SHA-256 hash |
| `2026-05-06-browser-session-token-storage.md` | Browser session storage hardening for web auth tokens |
| `2026-05-06-distributed-rate-limits.md` | Production-safe global and download rate-limit store behavior |
| `2026-05-06-list-count-consistency.md` | Paginated API list/count consistency strategy |
| `2026-05-06-refresh-token-hardening.md` | Single-use refresh-token rotation and reuse detection for web sessions |
| `2026-05-19-help-center.md` | Public Help Center page for ordinary console users, with i18n content, docs navigation, and responsive directory behavior |
| `2026-08-25-skill-delete-confirmation.md` | Confirmation dialog with destructive confirm for Local Skills delete action: full paths, agent ownership, type-to-confirm |

## Guidelines

- Add a new spec when the work changes user-facing behavior or introduces a new boundary.
- Keep implementation progress in `docs/exec-plans/`, not in spec files.
