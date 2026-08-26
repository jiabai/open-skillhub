# Exec Plan: Local Skill Content-Hash Fallback Comparison

- Spec: `desktop-client/docs/product-specs/2026-08-26-local-skill-content-hash-compare.md`
- Status: Completed (2026-08-26) — all 203 tests pass, `tsc` clean for touched files

## Post-Implementation Bug Fix (2026-08-26)

Symptom: rows correctly showed `update-available`, but clicking Upload failed.

Root cause (two-part):

1. `uploadLocalSkillPackage` never sent the `skill_uuid` form field, so the backend
   `/api/v1/client/skills/upload` route took the create-skill path, which rejects
   duplicate names with `SKILL_ALREADY_EXISTS` (`backend/services/skill_upload.py`).
2. Even with `skill_uuid`, the backend update path (`upload_zip_from_path`) responds
   without `id`/`name`, tripping the client guard "Client upload response is missing
   the uploaded skill name".

Fix (red→green regression test in `src/__tests__/local-skill-client-api.test.ts`):

- `src/core/local-skills/local-skill-client-api.ts`: request accepts `skillId`/
  `skillName`; sends `skill_uuid` when `skillId` is set; falls back to caller-supplied
  id/name when the update response omits them.
- `electron/main.ts`: `uploadLocalSkillByRowKey` passes `row.remoteSkillId` and
  `row.name`.
- Design doc Section 9 updated (previously mandated "Do not send `skill_uuid` in v1",
  which was the design-level origin of this bug).

## Files to Change

1. `src/adapters/agents/base.ts`
   - Add `export` to existing `computeSkillContentHash` (no logic change).
2. `src/core/local-skills/local-skill-inventory-service.ts`
   - Import `computeSkillContentHash`.
   - Add injectable dependency `computeContentHash?: (rootPath: string) => Promise<string>`.
   - In `buildRow`: after preliminary `createServerState`, when the outcome would be
     `existing` and the semver comparison is not `installed-older` (i.e. version same /
     unknown / missing), compute local hash and re-evaluate:
     - `localHash !== remoteSkill.contentHash` → `update-available`.
   - Wrap hash computation in try/catch; on error keep `existing`.
3. `src/__tests__/local-skill-inventory-service.test.ts`
   - New cases: hash-differ → update-available; hash-equal → existing; remote hash null →
     existing; older version → existing even with hash differ; hash error → existing;
     no hash computation when semver decisive (assert via injectable spy).

## Order of Work

1. Export hash helper.
2. Implement fallback in inventory service.
3. Tests.
4. Validation: `npm test`, `npx tsc --noEmit`.
5. Docs: design doc section 7 update, task-tracker entry, archive this plan to
   `docs/exec-plans/completed/`.

## Decisions

- Hash fallback only when semver is NOT decisive; `installed-older` intentionally returns
  `existing` (upload would downgrade server).
- Hash is computed per refresh on demand; no caching in v1 (acceptable: local skill packages
  are small; refresh is user-triggered).
- Reuse the exact backend algorithm (`computeSkillContentHash`) to guarantee comparability.

## Verification

- `cd desktop-client && npm test`
- `cd desktop-client && npx tsc --noEmit`
- Manual check with `vibe-coding-launcher` (local hash `53b5f671...` vs remote `b1d24d99...`)
  should now show update-available.
