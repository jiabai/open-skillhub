# Product Spec: Local Skill Content-Hash Fallback Comparison

- Date: 2026-08-26
- Status: Approved
- Related: `2026-05-01-local-skills-management.md`, `2026-08-25-local-skill-version-compare` (semver comparison)

## User-Visible Goal

When a local skill's content differs from the server copy, the Local Skills view must show
"可上传更新服务端 / Update available on server" and enable the upload button — even when the
local `SKILL.md` has no `version` field (or a non-semver version) and the existing semver
comparison cannot decide.

## Problem

Discovered with `vibe-coding-launcher`:

- Local directory content hash: `53b5f671...` (computed live from 19 files)
- Server `skill_versions.content_hash`: `b1d24d99...`
- Local `SKILL.md` frontmatter has **no `version`** field → semver comparison is skipped →
  server state falls back to `existing` → upload disabled.

The Local Skills refresh path never computes a local content hash, so pure content drift is
invisible whenever the version comparison cannot decide.

## Scope

- In Local Skills inventory refresh, when a local skill matches a remote skill by name AND the
  semver comparison is not decisive (`same`, `unknown`, or missing version), compute the local
  package content hash (same SHA-256 algorithm as backend) and compare it with the remote
  `contentHash`:
  - Hashes differ → `serverState = "update-available"` → upload enabled.
  - Hashes equal, remote hash missing, or hash computation fails → keep `existing`.
- Semver precedence is preserved:
  - Local version strictly newer → `update-available` (no hash computation needed).
  - Local version strictly older → `existing` (uploading would downgrade the server; hash is
    not consulted).

## Non-Goals

- No change to the Sync/Updates polling path (it uses stored installed hashes).
- No change to upload behavior itself (still uploads the primary row's package).
- No background polling for Local Skills (refresh stays on-demand).
- No UI text changes beyond reusing the existing `updateAvailable` badge.

## Affected Surfaces

- `desktop-client/src/adapters/agents/base.ts` — export `computeSkillContentHash`.
- `desktop-client/src/core/local-skills/local-skill-inventory-service.ts` — hash fallback in
  `createServerState` path, injectable hash dependency for tests.

## Acceptance Criteria

1. Local skill with no `version`, name matches server, local hash ≠ remote hash →
   `serverState = "update-available"`, `uploadable = true`.
2. Local skill with equal semver version but differing content hash → `update-available`.
3. Local skill with strictly older semver version → `existing` regardless of hash.
4. Remote `contentHash` null → `existing` (no comparison possible).
5. Hash computation error (unreadable file) does not break refresh; falls back to `existing`.
6. Hash is computed only when needed (name matched + lookup ok + semver not decisive).
7. All existing tests pass; new unit tests cover criteria 1–6.

## Follow-up Fix: Aligning Hash Scope with Upload Packages

- Date: 2026-08-26
- Root cause: local content hashing traversed runtime and repository directories that
  `prepareLocalSkillUploadPackage` intentionally omitted (`__pycache__`, `.git`, and
  `node_modules`). After upload, the server therefore stored a hash for different bytes,
  leaving the row incorrectly marked as update-available.
- Resolution: `SKILL_PACKAGE_IGNORED_DIRECTORY_NAMES` is now shared by upload packaging and
  `computeSkillContentHash`, so both compute the digest over the same packaged file set.
- Regression coverage: `src/__tests__/local-skill-upload-package.test.ts` verifies that adding
  files under those ignored directories does not change the local content hash or ZIP entries.
