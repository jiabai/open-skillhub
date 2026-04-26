# Package Artifact Cleanup Exec Plan

## Goal

Implement the package artifact cleanup ownership contract from
`docs/design-docs/package-artifact-cleanup.md` so distribution-created package
artifacts are removed after success or failure without deleting external paths.

## Scope

- Add optional artifact cleanup ownership to `DownloadedSkillArtifact`.
- Implement a best-effort cleanup tracker inside `src/core/distribution/package-service.ts`.
- Validate cleanup paths before registration and reject unsafe cleanup contracts.
- Clean registered download/decrypt/temp targets on all post-download errors and through `PreparedSkillPackage.cleanup()`.
- Update Electron runtime downloads to use a unique per-package cache staging directory and return that directory as owned cleanup.
- Add focused package-service tests plus distribution/runtime coverage.
- Update desktop architecture and runtime/storage docs for cache staging cleanup behavior.

## Non-Goals

- No renderer, IPC, State DB, or product API changes.
- No cleanup of agent installation target directories.
- No persistent distribution history, backup, or rollback implementation.
- No cleanup of partial paths from a `downloadArtifact()` implementation that throws before returning.

## Progress

- [x] Design checked against current package/distribution code; no blocking logic issue found.
- [x] Active plan and task tracker updated.
- [x] Shared type and package-service cleanup tracker implemented.
- [x] Electron download staging updated.
- [x] Tests added/updated.
- [x] Durable docs updated.
- [x] Validation gates passed.

## Decisions

- Treat `docs/design-docs/package-artifact-cleanup.md` as the approved technical
  source because it is marked final design for implementation handoff.
- Preserve the existing `PreparedSkillPackage.cleanup()` public contract; callers
  stay unaware of internal artifact paths.
- Preserve the current local change in `electron/main.ts` that omits the
  pre-distribution-check TTL option.
- Cleanup path validation rejects empty, relative, and filesystem-root paths
  before they are registered with `removePath()`.
- Runtime download filenames are normalized to a single safe cache filename
  segment before joining them under the owned staging directory.

## Validation Plan

- `cd desktop-client && npm test`
- `cd desktop-client && npm run build`
- `python scripts/validate_agents_docs.py --level ERROR`

## Validation Results

- `cd desktop-client && npm test` passed with 13 test files and 62 tests.
- `cd desktop-client && npm run build` passed, including Electron typechecking and renderer/Electron builds.
- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors and 0 warnings.

## Notes

- `downloadArtifact()` failures before returning remain the dependency's
  responsibility; package-service cannot clean paths it never receives.
- Cleanup warnings must not mask distribution success or the original failure.

## Status

- `completed`: package artifact cleanup now uses explicit cleanup ownership,
  runtime downloads use per-package cache staging, package-service cleanup is
  best-effort across success and failure paths, and docs/tests are updated.
