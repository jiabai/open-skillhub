# Package 产物清理 - 最终技术设计

<!-- [STATUS] 已实现 (Implemented) -->
状态：最终设计，可供实现交付
最后更新：2026-04-26
范围：`desktop-client/`

> 分发流程完成或失败后，桌面端必须清理本次分发创建的下载包、解密产物和解压目录。清理必须显式基于产物所有权，不能因为某个路径出现在 `artifactPath` 中就默认递归删除。

## 1. 问题陈述

当前 `src/core/distribution/package-service.ts` 只清理 `validateAndExtract()` 创建的 `tempRoot`：

```text
downloadArtifact()        -> 创建或返回 artifactPath
decryptArtifact()?        -> 可能创建解密后的产物
createTempDirectory()     -> 创建 tempRoot
extractArtifact()         -> 解压到 tempRoot/extracted
distribution-service      -> 从 extractedPath 安装
preparedPackage.cleanup() -> 仅移除 tempRoot
```

这会留下两类风险：

1. **磁盘冗余**：当前 Electron 下载实现把包写入 runtime `cache/`，分发结束后没有删除。
2. **敏感内容残留**：未加密下载包、未来的解密明文包、以及解压目录都可能包含 skill 源码。

上一版草案的问题是把 `downloadedArtifact.artifactPath` 直接加入删除列表。这个逻辑不安全，因为 `DownloadedSkillArtifact` 当前没有说明 `artifactPath` 是否由本次分发创建、是否允许删除。测试和未来依赖实现可能返回外部 fixture、持久缓存或用户选择的文件路径。最终设计必须先补齐所有权合约，再执行清理。

## 2. 设计目标

- 清理本次分发创建且声明可删除的 package artifacts。
- 继续通过 `PreparedSkillPackage.cleanup()` 作为 `distribution-service` 的唯一清理入口。
- 在提取、验证、缺少 decryptor、安装失败、部分安装失败和成功安装后都执行同一套清理。
- 清理失败不能覆盖原始分发错误，也不能改变分发结果。
- 清理逻辑必须避免递归删除未声明所有权的外部路径。

## 3. 非目标

- 不实现持久化 distribution history。
- 不实现 backup 或 rollback。
- 不改变 renderer、IPC 或用户交互。
- 不清理 agent 安装目标目录。
- 不尝试清理 `downloadArtifact()` 抛错前可能留下的部分文件；这种文件在 package service 没有路径，必须由 `downloadArtifact()` 实现自行处理。

## 4. 当前代码事实

这些事实来自当前实现，编码时必须保持一致：

- `distribution-service.distribute()` 已经在 `finally` 中调用 `preparedPackage.cleanup()`。
- `PreparedSkillPackage` 公开类型包含 `cleanup(): Promise<void>`，调用方不需要知道内部产物路径。
- `DownloadedSkillArtifact` 包含 `artifactPath`、`encrypted` 和可选的 `cleanupPaths`。
- `downloadSkillArtifact()` 位于 `electron/main.ts`，当前把下载内容写到 `config.cacheDirectory` 下的文件。
- `PackageServiceDependencies` 已有 `removePath?` 注入点，测试可以替换删除行为。
- `decryptArtifact` 已在 `electron/encryption.ts` 中实现；当 `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` 缺失或无效时，加密包仍然 fail closed。

## 5. 最终架构决策

采用 **显式清理所有权（explicit cleanup ownership）**：

- artifact producer 声明自己创建且允许删除的路径。
- `package-service` 只清理这些显式声明的路径，加上自己创建的 extraction temp root。
- `package-service` 永远不因为 `artifactPath` 存在就默认删除它。

数据流：

```text
downloadArtifact()
  -> 返回 { artifactPath, encrypted, cleanupPaths? }

package-service
  -> 验证 artifactPath
  -> 仅记录 cleanupPaths
  -> 创建 tempRoot 并记录 tempRoot
  -> 解压并验证 package
  -> 返回带有 cleanup() 闭包的 PreparedSkillPackage

distribution-service
  -> 安装或记录每个目标的失败情况
  -> 最终调用 preparedPackage.cleanup()
```

## 6. 产物所有权合约

为 `DownloadedSkillArtifact` 扩展一个可选字段：

```typescript
export interface DownloadedSkillArtifact {
  artifactPath: string
  encrypted: boolean

  /**
   * package-service 可在提取/安装完成后移除的、
   * 为此产物创建的绝对路径（文件或目录）。
   *
   * package-service 绝不能仅从 artifactPath 推断清理所有权。
   */
  cleanupPaths?: string[]
}
```

规则：

- `cleanupPaths` 是向后兼容的可选字段；现有测试或依赖如果省略它，仍然可以编译。
- 如果省略 `cleanupPaths`，`package-service` 会从 `artifactPath` 提取，但不会删除该路径。
- `cleanupPaths` 中的路径必须是绝对路径，且不能是文件系统根目录。
- 目录清理是递归的。
- 重复路径会被归一化，只删除一次。
- 允许嵌套路径，但 producer 应优先使用单个 per-package 暂存目录。

## 7. 运行时下载暂存

更新 `electron/main.ts`，让 `downloadSkillArtifact()` 在 runtime cache 下创建唯一的暂存目录：

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

为什么这样做很重要：

- 整个暂存目录归当前 package run 所有。
- 清理不会删除共享的 `cache/` 目录。
- 并发分发不会覆盖确定性的缓存文件名。
- 未来的解密文件可以写入同一个暂存目录，并通过已有的 `cleanupPaths` 清理。

如果 `writeFile()` 在创建 `artifactRoot` 后失败，`downloadSkillArtifact()` 应在重新抛出错误前尽力移除 `artifactRoot`，因为 package-service 在依赖抛出错误时不会收到路径。

## 8. 解密合约

当前 `decryptArtifact()` 实现遵循以下合约：

- 成功解密后必须返回 `encrypted: false`。
- 如果未来实现需要在已注册的清理根目录之外写入新产物，必须将该路径或父目录包含在 `cleanupPaths` 中。
- 如果它原地解密，可以返回相同的 `artifactPath`；已有的清理根目录仍然适用。
- 当前实现会将解密后的文件写入 `downloadArtifact()` 返回的暂存目录，因此不需要额外的清理路径，因为暂存目录已经被跟踪。

Fail closed 规则：

- 如果 `decryptArtifact()` 返回 `encrypted: true`，package-service 必须在提取前抛出错误。
- 如果解密后的 `artifactPath` 不在所有已知清理根目录内，且未在 `cleanupPaths` 中声明，package-service 必须在提取前抛出错误。这防止从可能遗留的模糊明文路径安装。

## 9. 清理算法

在 `package-service.ts` 内部添加一个小型清理追踪器；不要通过 `PreparedSkillPackage` 暴露路径。

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

必需行为：

- `downloadArtifact()` 解析后立即注册 `downloadedArtifact.cleanupPaths`。
- `decryptArtifact()` 解析后立即注册解密产物清理路径。
- `createTempDirectory()` 解析后立即注册 `tempRoot`。
- 将整个下载后流程包裹在 `try/catch` 中；发生任何错误时，调用 `cleanupAll()`，然后重新抛出原始错误。
- 返回的 `PreparedSkillPackage.cleanup()` 调用同一个 `cleanupAll()` 闭包。
- `cleanupAll()` 必须是尽力而为且不抛出异常的，这样它不会掩盖分发成功或原始失败。

## 10. 路径安全

在注册清理路径之前：

- 将其解析为绝对归一化路径。
- 拒绝非绝对路径。
- 拒绝文件系统根目录，如 `C:\`、`/` 或驱动器根目录。
- 拒绝空路径。

无效的清理路径属于合约错误：

- 在 `validateAndExtract()` 期间，抛出明确的错误，并对已注册的目标执行清理。
- 不要对无效的清理路径调用 `removePath()`。

这与 `validateArtifactPath()` 是分开的：外部产物可能对读取有效，但不归清理所有。

## 11. 错误处理

清理不得改变分发语义。

| 场景 | 行为 |
| --- | --- |
| `downloadArtifact()` 在返回前抛出 | package-service 无法清理未知路径；依赖方负责部分清理。 |
| `downloadArtifact()` 返回无效的产物路径 | 清理已声明的 cleanupPaths，然后抛出验证错误。 |
| 加密包没有 decryptor | 清理已声明的下载 cleanupPaths，然后抛出已有的 decryptor 错误。 |
| `decryptArtifact()` 抛出 | 清理已注册的目标，然后重新抛出解密错误。 |
| `decryptArtifact()` 返回无效/模糊的产物 | 清理已注册的目标，然后抛出合约错误。 |
| 提取或验证失败 | 清理下载/解密/临时目标，然后重新抛出原始错误。 |
| 安装成功或部分失败 | `distribution-service` 最终调用 cleanup 一次。 |
| 清理目标已不存在 | 如果 `removePath` 是幂等的，不需要警告；否则警告并继续。 |
| 清理目标移除失败 | 警告并继续剩余清理目标。 |

默认警告行为：

```typescript
const warn = dependencies.warn ?? ((message, error) => console.warn(message, error))
```

添加可选依赖：

```typescript
warn?(message: string, error: unknown): void
```

这样可以在不引入日志框架的情况下保持测试的确定性。

## 12. 类型与 API 影响

修改 `src/types/index.ts`：

- 为 `DownloadedSkillArtifact` 添加可选的 `cleanupPaths?: string[]`。
- 保持 `PreparedSkillPackage` 不变。

修改 `src/core/distribution/package-service.ts`：

- 添加清理追踪器。
- 添加清理路径验证。
- 添加可选的 `warn` 依赖。
- 在成功和所有下载后错误路径中使用清理追踪器。

修改 `electron/main.ts`：

- 更改下载产物写入为 per-package 暂存目录。
- 返回 `cleanupPaths: [artifactRoot]`。
- 如果写入归档失败，尽力移除 `artifactRoot`。

不需要修改 renderer、IPC、State DB 或产品 API。

## 13. 实现文件映射

创建：

| 文件 | 职责 |
| --- | --- |
| `src/__tests__/package-service.test.ts` | 针对清理所有权、错误、解密、幂等性和路径安全的聚焦测试。 |

修改：

| 文件 | 变更 |
| --- | --- |
| `src/types/index.ts` | 为 `DownloadedSkillArtifact` 添加 `cleanupPaths?: string[]`。 |
| `src/core/distribution/package-service.ts` | 实现清理追踪器和安全清理合约。 |
| `electron/main.ts` | 使用唯一的 runtime-cache 暂存目录并返回清理所有权。 |
| `src/__tests__/distribution-service.test.ts` | 保持分发断言一致；除非提供 `cleanupPaths`，否则不要假设外部产物路径会被删除。 |
| `desktop-client/docs/ARCHITECTURE.md` | 实现后，记录 runtime package cache 是暂存区，不是持久的 package 存储。 |
| `desktop-client/docs/references/runtime-and-storage-surface.md` | 实现后，记录 cache 暂存清理行为。 |

## 14. 测试策略

Package-service 单元测试：

- 带有 `cleanupPaths` 的未加密产物会清理产物暂存目录和提取 temp root
- 没有 `cleanupPaths` 的未加密产物不会删除外部 `artifactPath`
- 没有可用 decryptor 或缺少解密密钥的加密产物会清理已声明的下载暂存目录
- 返回 `encrypted: true` 的 decryptor 会 fail closed 并清理已注册的路径
- 在已注册暂存目录内写入的 decryptor 会被接受
- 在清理根目录外写入且不声明所有权的 decryptor 会 fail closed
- 提取失败会清理所有已注册目标并重新抛出提取错误
- 验证失败会清理所有已注册目标并重新抛出验证错误
- 清理警告路径会继续删除后续目标
- 无效的 cleanupPaths 会被拒绝，永远不会传递给 `removePath`
- 重复的 cleanupPaths 只删除一次
- 当 `removePath` 是幂等的时，调用 `cleanup()` 两次不会抛出

运行时/下载测试：

- `downloadSkillArtifact()` 写入 runtime cache 下唯一的暂存目录；如果它保留在 `electron/main.ts` 中为私有，用已有的源码级 Electron 运行时测试覆盖，而不是仅为了测试而导出运行时内部
- 返回的产物包含 `cleanupPaths: [artifactRoot]`
- 归档写入失败时尽力移除 `artifactRoot`

分发测试：

- 成功分发仍然会移除 `result.extractedPath`
- 部分分发仍然会调用清理
- 外部测试 fixture 产物除非声明 `cleanupPaths`，否则不会被删除

验证命令：

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
```

## 15. 迁移说明

- 不需要数据迁移。
- 现有返回 `{ artifactPath, encrypted }` 的依赖仍然可以工作。
- 只有选择加入 `cleanupPaths` 的依赖才会移除这些路径。
- Electron 运行时下载实现必须选择加入，这样下载的包文件在分发后不再留在 `cache/` 中。
- 现有的 `PreparedSkillPackage` 消费者保持不变。

## 16. 早期草案的已解决问题

- 移除了每个 `artifactPath` 都可丢弃的不安全假设。
- 通过可选的 `cleanupPaths` 添加了显式清理所有权。
- 添加了唯一的暂存目录，这样 runtime cache 清理不会删除不相关的 cache 内容或在并发分发之间冲突。
- 要求 `cleanup()` 尽力而为且不抛出异常，这样清理失败不会掩盖分发结果。
- 添加了提取前错误的处理，包括缺少 decryptor 和无效产物路径。
- 添加了清理目标的路径安全规则。
- 通过验证 `electron/main.ts` 中的当前下载行为解决了早期未知问题；现在已有主进程 decryptor，但缺少有效运行时解密密钥时仍然 fail closed。

## 17. 参考资料

- 核心信念：`core-beliefs.md`
- 架构：`../ARCHITECTURE.md`
- 安全：`../SECURITY.md`
- 运行时/存储参考：`../references/runtime-and-storage-surface.md`
- Package service：`../../src/core/distribution/package-service.ts`
- Distribution service：`../../src/core/distribution/distribution-service.ts`
- Electron 运行时下载：`../../electron/main.ts`
