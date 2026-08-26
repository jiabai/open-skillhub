# Local Skill Version Comparison Exec Plan

## Goal

Add semver-based version comparison to the Local Skills inventory so that when a
local skill has a higher version than the server copy, the view shows an
"update-available" badge and enables the upload button, allowing operators to
push the newer local version to the server.

## Problem

The Local Skills view previously classified server presence only by name:
`existing` (same name found on server) or `missing` (not found). When a local
skill was newer than the server copy, the view only showed "On server" /
"服务端已存在" with no indication that an upload would update the server.

## Scope

- Add `update-available` to `LocalSkillServerState` union type.
- Extend `createServerState` to accept `localVersion` and compare against the
  remote version using `compareStrictSemverVersions`.
- Change `uploadable` to be true for both `missing` and `update-available`.
- Update `pickPrimaryRow` to prefer `update-available` rows alongside `existing`.
- Add i18n label `updateAvailable` in en-US and zh-CN.
- Add UI badge tone and label handling for the new state.

## Non-Goals

- No automatic upload or bulk update.
- No content hash comparison (semver is sufficient for the v1 update signal).
- No changes to the upload packaging or API contract.
- No changes to the Sync service's content-hash based update detection.

## Decisions

- Comparison uses the existing `compareStrictSemverVersions` utility from
  `@/core/pre-distribution-check/version-compare.ts`.
- Non-semver versions (e.g. "latest", date strings) fall back to `existing` /
  `missing` without version-based classification.
- `installed-newer` from semver comparison maps to `update-available`.
- `same` and `installed-older` both map to `existing` — only local-newer
  versions surface the upload button.
- The upload button remains disabled for rows where the server version is
  equal to or newer than the local version.

## File Map

Modified:

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `update-available` to `LocalSkillServerState` |
| `src/core/local-skills/local-skill-inventory-service.ts` | Import `compareStrictSemverVersions`, extend `createServerState` with version comparison, update `uploadable` and `pickPrimaryRow` |
| `src/components/local-skills-view.tsx` | Add `update-available` case to `serverStateLabel` and `badgeTone` |
| `src/i18n/messages/types.ts` | Add `updateAvailable: string` to `serverStateLabels` |
| `src/i18n/messages/en-US.ts` | Add `updateAvailable: "Update available on server"` |
| `src/i18n/messages/zh-CN.ts` | Add `updateAvailable: "可上传更新服务端"` |
| `docs/design-docs/local-skills-management.md` | Update type definition and server presence rules |
| `docs/product-specs/2026-05-01-local-skills-management.md` | Update state table and upload behavior |
| `task-tracker.md` | Record completed task |

## Implementation Steps

1. Add `update-available` to `LocalSkillServerState` in `types/index.ts`.
2. Import `compareStrictSemverVersions` in `local-skill-inventory-service.ts`.
3. Extend `createServerState` with `localVersion` parameter and semver
   comparison logic.
4. Update `buildRow` to pass `localVersion` into `createServerState`.
5. Update `uploadable` condition: `serverState === "missing" || serverState === "update-available"`.
6. Update `pickPrimaryRow` to recognize `update-available` as a valid state.
7. Add `serverStateLabel` and `badgeTone` cases for `update-available` in
   `local-skills-view.tsx`.
8. Add `updateAvailable` i18n keys in `types.ts`, `en-US.ts`, `zh-CN.ts`.
9. Update design and product docs.

## Validation Plan

```bash
cd desktop-client
npm test
npm run build
cd ..
python scripts/validate_agents_docs.py --level ERROR
```

## Validation Results

- `npm test`: 36 test files, 195 tests passed (2026-08-26).
- `npm run build`: passes (2026-08-26).

## Outcome

Implemented. Local Skills inventory now compares local semver against remote
semver and classifies local-newer rows as `update-available`, which shows a
warning badge and enables the upload button. Non-semver versions fall back to
the existing name-match behavior.
