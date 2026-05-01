# Package Artifact Cleanup - Final Technical Design

Status: final design for implementation handoff
Last updated: 2026-04-26
Scope: `desktop-client/`

> After the distribution process completes or fails, the desktop client must clean up the downloaded packages, decrypted artifacts, and extraction directories created during this distribution. Cleanup must be explicitly based on artifact ownership and must not recursively delete paths simply because they appear in `artifactPath`.

## 1. Problem Statement

Currently `src/core/distribution/package-service.ts` only cleans up the `tempRoot` created by `validateAndExtract()`:

```text
downloadArtifact()        -> creates or returns artifactPath
decryptArtifact()?        -> may create a decrypted artifact
createTempDirectory()     -> creates tempRoot
extractArtifact()         -> extracts into tempRoot/extracted
distribution-service      -> installs from extractedPath
preparedPackage.cleanup() -> removes tempRoot only
```

This leaves two categories of risk:

1. **Disk redundancy**: The current Electron download implementation writes packages to the runtime `cache/`, but does not delete them after distribution completes.
2. **Sensitive content residue**: Unencrypted download packages, future decrypted plaintext packages, and extraction directories may all contain skill source code.

The problem with the previous draft was directly adding `downloadedArtifact.artifactPath` to the deletion list. This logic is unsafe because `DownloadedSkillArtifact` currently does not specify whether `artifactPath` was created by this distribution or whether it is allowed to be deleted. Tests and future dependency implementations may return external fixtures, persistent caches, or user-selected file paths. The final design must first complete the ownership contract before executing cleanup.

## 2. Goals

- Clean up package artifacts created and declared as deletable by this distribution.
- Continue using `PreparedSkillPackage.cleanup()` as the sole cleanup entry point for `distribution-service`.
- Execute the same cleanup routine after extraction, validation, missing decryptor, installation failure, partial installation failure, and successful installation.
- Cleanup failures must not overwrite the original distribution error or change the distribution result.
- Cleanup logic must avoid recursively deleting external paths that have not declared ownership.

## 3. Non-Goals

- Do not implement persistent distribution history.
- Do not implement backup or rollback.
- Do not change renderer, IPC, or user interaction.
- Do not clean up agent installation target directories.
- Do not attempt to clean up partial files that may have been left before `downloadArtifact()` throws; such files are not in the package service's path and must be handled by the `downloadArtifact()` implementation itself.

## 4. Current Code Facts

These facts come from the current implementation and must be kept consistent during coding:

- `distribution-service.distribute()` already calls `preparedPackage.cleanup()` in a `finally` block.
- `PreparedSkillPackage` exposes a public type containing `cleanup(): Promise<void>`; callers do not need to know internal artifact paths.
- `DownloadedSkillArtifact` has `artifactPath`, `encrypted`, and optional `cleanupPaths`.
- `downloadSkillArtifact()` is located in `electron/main.ts` and currently writes downloaded content to files under `config.cacheDirectory`.
- `PackageServiceDependencies` already has a `removePath?` injection point; tests can substitute deletion behavior.
- `decryptArtifact` is implemented in `electron/encryption.ts`; encrypted packages still fail closed when `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET` is missing or invalid.

## 5. Final Architecture Decision

Adopt **explicit cleanup ownership**:

- Artifact producers declare paths they created and allow to be deleted.
- `package-service` only cleans these explicitly declared paths, plus the extraction temp root it creates itself.
- `package-service` never defaults to deleting a path simply because `artifactPath` exists.

Data flow:

```text
downloadArtifact()
  -> returns { artifactPath, encrypted, cleanupPaths? }

package-service
  -> validates artifactPath
  -> records cleanupPaths only
  -> creates tempRoot and records tempRoot
  -> extracts and validates package
  -> returns PreparedSkillPackage with cleanup() closure

distribution-service
  -> installs or records per-target failures
  -> finally awaits preparedPackage.cleanup()
```

## 6. Artifact Ownership Contract

Extend `DownloadedSkillArtifact` with one optional field:

```typescript
export interface DownloadedSkillArtifact {
  artifactPath: string
  encrypted: boolean

  /**
   * Absolute files or directories created for this artifact that package-service
   * may remove after extraction/installation finishes.
   *
   * package-service must never infer cleanup ownership from artifactPath alone.
   */
  cleanupPaths?: string[]
}
```

Rules:

- `cleanupPaths` is additive and backward-compatible; existing tests or dependencies that omit it still compile.
- If `cleanupPaths` is omitted, `package-service` extracts from `artifactPath` but does not delete that path.
- Paths in `cleanupPaths` must be absolute and must not be filesystem roots.
- Directory cleanup is recursive.
- Duplicate paths are normalized and deleted once.
- Nested paths are allowed, but producers should prefer a single per-package staging directory.

## 7. Runtime Download Staging

Update `electron/main.ts` so `downloadSkillArtifact()` creates a unique staging directory under runtime cache:

```typescript
const artifactRoot = await mkdtemp(join(config.cacheDirectory, "package-"))
const artifactPath = join(artifactRoot, fileName)
await writeFile(artifactPath, archiveBytes)

return {
  artifactPath,
  encrypted: payload.encryption_enabled,
  cleanupPaths: [artifactRoot]
}
```

Why this matters:

- The whole staging directory is owned by the current package run.
- Cleanup does not delete the shared `cache/` directory.
- Concurrent distributions cannot trample a deterministic cache filename.
- Future decrypted files can be written into the same staging directory and cleaned by the existing `cleanupPaths`.

If `writeFile()` fails after creating `artifactRoot`, `downloadSkillArtifact()` should best-effort remove `artifactRoot` before rethrowing, because package-service will not receive the path when the dependency throws.

## 8. Decryption Contract

The current `decryptArtifact()` implementation follows this contract:

- It must return `encrypted: false` after successful decryption.
- If a future implementation writes a new artifact outside already registered cleanup roots, it must include that path or parent directory in `cleanupPaths`.
- If it decrypts in place, it can return the same `artifactPath`; existing cleanup roots still apply.
- The current implementation writes the decrypted file into the download staging directory returned by `downloadArtifact()`, so no extra cleanup path is required because the staging directory is already tracked.

Fail closed rule:

- If `decryptArtifact()` returns `encrypted: true`, package-service must throw before extraction.
- If the decrypted `artifactPath` is outside all known cleanup roots and is not declared in `cleanupPaths`, package-service must throw before extraction. This prevents installing from an ambiguous plaintext path that may be left behind.

## 9. Cleanup Algorithm

Add a small cleanup tracker inside `package-service.ts`; do not expose paths through `PreparedSkillPackage`.

```typescript
type CleanupTarget = {
  path: string
  label: "download-artifact" | "decrypted-artifact" | "extraction-root"
}

function createCleanupTracker(options: {
  removePath(path: string): Promise<void>
  warn(message: string, error: unknown): void
}) {
  const targets: CleanupTarget[] = []
  const seen = new Set<string>()

  function add(path: string, label: CleanupTarget["label"]): void {
    const normalized = normalizeCleanupPath(path)

    if (seen.has(normalized)) {
      return
    }

    seen.add(normalized)
    targets.push({ path: normalized, label })
  }

  async function cleanupAll(): Promise<void> {
    for (const target of [...targets].reverse()) {
      try {
        await options.removePath(target.path)
      } catch (error) {
        options.warn(`Failed to clean up ${target.label}: ${target.path}`, error)
      }
    }
  }

  return { add, cleanupAll }
}
```

Required behavior:

- Register `downloadedArtifact.cleanupPaths` immediately after `downloadArtifact()` resolves.
- Register decrypted artifact cleanup paths immediately after `decryptArtifact()` resolves.
- Register `tempRoot` immediately after `createTempDirectory()` resolves.
- Wrap the whole post-download flow in `try/catch`; on any error, call `cleanupAll()` and then rethrow the original error.
- The returned `PreparedSkillPackage.cleanup()` calls the same `cleanupAll()` closure.
- `cleanupAll()` must be best-effort and non-throwing, so it cannot mask distribution success or the original failure.

## 10. Path Safety

Before a cleanup path is registered:

- Resolve it to an absolute normalized path.
- Reject non-absolute paths.
- Reject filesystem roots such as `C:\`, `/`, or a drive root.
- Reject empty paths.

Invalid cleanup paths are contract errors:

- During `validateAndExtract()`, throw a clear error and run cleanup for already registered targets.
- Do not call `removePath()` for invalid cleanup paths.

This is separate from `validateArtifactPath()`: an external artifact may be valid to read but not owned for cleanup.

## 11. Error Handling

Cleanup must not alter distribution semantics.

| Scenario | Behavior |
| --- | --- |
| `downloadArtifact()` throws before returning | package-service cannot clean unknown paths; dependency owns partial cleanup. |
| `downloadArtifact()` returns invalid artifact path | clean declared cleanup paths, then throw validation error. |
| encrypted package has no decryptor | clean declared download cleanup paths, then throw existing decryptor error. |
| `decryptArtifact()` throws | clean already registered targets, then rethrow decrypt error. |
| `decryptArtifact()` returns invalid/ambiguous artifact | clean registered targets, then throw contract error. |
| extract or validation fails | clean download/decrypt/temp targets, then rethrow original error. |
| install succeeds or partially fails | `distribution-service` finally calls cleanup once. |
| cleanup target is already gone | no warning required if `removePath` is idempotent; otherwise warn and continue. |
| cleanup target removal fails | warn and continue remaining cleanup targets. |

Default warning behavior:

```typescript
const warn = dependencies.warn ?? ((message, error) => console.warn(message, error))
```

Add optional dependency:

```typescript
warn?(message: string, error: unknown): void
```

This keeps tests deterministic without introducing a logging framework.

## 12. Type And API Impact

Modify `src/types/index.ts`:

- Add optional `cleanupPaths?: string[]` to `DownloadedSkillArtifact`.
- Keep `PreparedSkillPackage` unchanged.

Modify `src/core/distribution/package-service.ts`:

- Add cleanup tracker.
- Add cleanup path validation.
- Add optional `warn` dependency.
- Use cleanup tracker in success and all post-download error paths.

Modify `electron/main.ts`:

- Change download artifact writes to a per-package staging directory.
- Return `cleanupPaths: [artifactRoot]`.
- Best-effort remove `artifactRoot` if writing the archive fails before return.

No renderer, IPC, State DB, or product API changes are required.

## 13. Implementation File Map

Create:

| File | Responsibility |
| --- | --- |
| `src/__tests__/package-service.test.ts` | Focused tests for cleanup ownership, errors, decryption, idempotency, and path safety. |

Modify:

| File | Change |
| --- | --- |
| `src/types/index.ts` | Add `cleanupPaths?: string[]` to `DownloadedSkillArtifact`. |
| `src/core/distribution/package-service.ts` | Implement cleanup tracker and safe cleanup contract. |
| `electron/main.ts` | Use unique runtime-cache staging directories and return cleanup ownership. |
| `src/__tests__/distribution-service.test.ts` | Keep distribution assertions aligned; avoid assuming external artifact paths are deleted unless `cleanupPaths` is supplied. |
| `desktop-client/docs/ARCHITECTURE.md` | After implementation, document that runtime package cache is staging, not durable package storage. |
| `desktop-client/docs/references/runtime-and-storage-surface.md` | After implementation, document cache staging cleanup behavior. |

## 14. Testing Strategy

Package-service unit tests:

- unencrypted artifact with `cleanupPaths` cleans artifact staging dir and extraction temp root
- unencrypted artifact without `cleanupPaths` does not delete external `artifactPath`
- encrypted artifact with no usable decryptor or missing decryption secret cleans declared download staging dir
- decryptor that returns `encrypted: true` fails closed and cleans registered paths
- decryptor that writes inside an already registered staging dir is accepted
- decryptor that writes outside cleanup roots without declaring ownership fails closed
- extraction failure cleans all registered targets and rethrows the extraction error
- validation failure cleans all registered targets and rethrows the validation error
- cleanup warning path continues deleting later targets
- invalid cleanup paths are rejected and never passed to `removePath`
- duplicate cleanup paths are deleted once
- calling `cleanup()` twice does not throw when `removePath` is idempotent

Runtime/download tests:

- `downloadSkillArtifact()` writes into a unique staging directory below runtime cache; if it remains private in `electron/main.ts`, cover this with the existing source-level Electron runtime tests instead of exporting runtime internals only for tests
- returned artifact includes `cleanupPaths: [artifactRoot]`
- failed archive write best-effort removes `artifactRoot`

Distribution tests:

- successful distribution still removes `result.extractedPath`
- partial distribution still calls cleanup
- external test fixture artifact is not deleted unless it declares `cleanupPaths`

Validation commands:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
```

## 15. Migration Notes

- No data migration is required.
- Existing dependencies returning `{ artifactPath, encrypted }` still work.
- Only dependencies that opt in with `cleanupPaths` have those paths removed.
- The Electron runtime download implementation must opt in so downloaded package files no longer remain in `cache/` after distribution.
- Existing `PreparedSkillPackage` consumers remain unchanged.

## 16. Resolved Issues From Earlier Draft

- Removed the unsafe assumption that every `artifactPath` is disposable.
- Added explicit cleanup ownership via optional `cleanupPaths`.
- Added a unique staging directory so runtime cache cleanup cannot delete unrelated cache content or collide across concurrent distributions.
- Required `cleanup()` to be best-effort and non-throwing so cleanup failures do not mask distribution results.
- Added handling for errors before extraction, including missing decryptor and invalid artifact paths.
- Added path safety rules for cleanup targets.
- Resolved the earlier unknowns by verifying current download behavior in `electron/main.ts`; a main-process decryptor now exists and remains fail-closed without a valid runtime decryption secret.

## 17. References

- Core beliefs: `core-beliefs.md`
- Architecture: `../ARCHITECTURE.md`
- Security: `../SECURITY.md`
- Runtime/storage reference: `../references/runtime-and-storage-surface.md`
- Package service: `../../src/core/distribution/package-service.ts`
- Distribution service: `../../src/core/distribution/distribution-service.ts`
- Electron runtime download: `../../electron/main.ts`
