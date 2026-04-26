# Package Artifact Cleanup - Final Technical Design

Status: final design for implementation handoff
Last updated: 2026-04-26
Scope: `desktop-client/`

> 分发流程完成或失败后，桌面端必须清理本次分发创建的下载包、解密产物和解压目录。清理必须显式基于产物所有权，不能因为某个路径出现在 `artifactPath` 中就默认递归删除。

## 1. Problem Statement

当前 `src/core/distribution/package-service.ts` 只清理 `validateAndExtract()` 创建的 `tempRoot`：

```text
downloadArtifact()        -> creates or returns artifactPath
decryptArtifact()?        -> may create a decrypted artifact
createTempDirectory()     -> creates tempRoot
extractArtifact()         -> extracts into tempRoot/extracted
distribution-service      -> installs from extractedPath
preparedPackage.cleanup() -> removes tempRoot only
```

这会留下两类风险：

1. **磁盘冗余**：当前 Electron 下载实现把包写入 runtime `cache/`，分发结束后没有删除。
2. **敏感内容残留**：未加密下载包、未来的解密明文包、以及解压目录都可能包含 skill 源码。

上一版草案的问题是把 `downloadedArtifact.artifactPath` 直接加入删除列表。这个逻辑不安全，因为 `DownloadedSkillArtifact` 当前没有说明 `artifactPath` 是否由本次分发创建、是否允许删除。测试和未来依赖实现可能返回外部 fixture、持久缓存或用户选择的文件路径。最终设计必须先补齐所有权合约，再执行清理。

## 2. Goals

- 清理本次分发创建且声明可删除的 package artifacts。
- 继续通过 `PreparedSkillPackage.cleanup()` 作为 `distribution-service` 的唯一清理入口。
- 在提取、验证、缺少 decryptor、安装失败、部分安装失败和成功安装后都执行同一套清理。
- 清理失败不能覆盖原始分发错误，也不能改变分发结果。
- 清理逻辑必须避免递归删除未声明所有权的外部路径。

## 3. Non-Goals

- 不实现持久化 distribution history。
- 不实现 backup 或 rollback。
- 不改变 renderer、IPC 或用户交互。
- 不清理 agent 安装目标目录。
- 不尝试清理 `downloadArtifact()` 抛错前可能留下的部分文件；这种文件在 package service 没有路径，必须由 `downloadArtifact()` 实现自行处理。

## 4. Current Code Facts

这些事实来自当前实现，编码时必须保持一致：

- `distribution-service.distribute()` 已经在 `finally` 中调用 `preparedPackage.cleanup()`。
- `PreparedSkillPackage` 公开类型包含 `cleanup(): Promise<void>`，调用方不需要知道内部产物路径。
- `DownloadedSkillArtifact` 当前只有 `artifactPath` 和 `encrypted`。
- `downloadSkillArtifact()` 位于 `electron/main.ts`，当前把下载内容写到 `config.cacheDirectory` 下的文件。
- `PackageServiceDependencies` 已有 `removePath?` 注入点，测试可以替换删除行为。
- 当前没有 `decryptArtifact` 实现；加密包在没有 decryptor 时 fail closed。

## 5. Final Architecture Decision

采用 **explicit cleanup ownership**：

- artifact producer 声明自己创建且允许删除的路径。
- `package-service` 只清理这些显式声明的路径，加上自己创建的 extraction temp root。
- `package-service` 永远不因为 `artifactPath` 存在就默认删除它。

数据流：

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

When a future `decryptArtifact()` implementation exists:

- It must return `encrypted: false` after successful decryption.
- If it writes a new artifact outside already registered cleanup roots, it must include that path or parent directory in `cleanupPaths`.
- If it decrypts in place, it can return the same `artifactPath`; existing cleanup roots still apply.
- If it writes the decrypted file into the download staging directory returned by `downloadArtifact()`, no extra cleanup path is required because the staging directory is already tracked.

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
- encrypted artifact with no decryptor cleans declared download staging dir
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
- Resolved the earlier unknowns by verifying current download behavior in `electron/main.ts` and confirming that no decryptor exists today.

## 17. References

- Core beliefs: `core-beliefs.md`
- Architecture: `../ARCHITECTURE.md`
- Security: `../SECURITY.md`
- Runtime/storage reference: `../references/runtime-and-storage-surface.md`
- Package service: `../../src/core/distribution/package-service.ts`
- Distribution service: `../../src/core/distribution/distribution-service.ts`
- Electron runtime download: `../../electron/main.ts`
