# Package Artifact Cleanup - Technical Design

## Problem Statement

当前 `package-service.ts` 的分发流程中，下载的原始产物和解密后的中间文件**从未被清理**，
导致磁盘上的文件冗余：

```
1. downloadArtifact()        → 下载到 cache/ 或临时位置（未清理）
2. decryptArtifact()         → 可能解密到新位置（未清理）
3. createTempDirectory()     → 创建 tempRoot
4. extractArtifact()         → 解压到 tempRoot/extracted
5. adapter.installSkill()    → 复制到 agent 目录
6. finally { cleanup() }     → 只清理 tempRoot ← 上游产物残留
```

## Scope

- 确保分发流程结束后，所有中间产物（下载文件、解密文件、临时目录）都被清理
- 保持 `PreparedSkillPackage` 的 `cleanup()` 作为唯一的清理入口
- 不改变现有的下载、解密、解压接口签名

## Non-Goals

- 不改变下载/解密的实现逻辑
- 不引入新的持久化层来跟踪历史产物
- 不处理上传场景的临时文件（上传功能尚未实现）

## Design Decisions

### Decision 1: 清理责任归属

**选择**：由 `package-service.ts` 统一追踪所有中间产物，在 `cleanup()` 中一次性清理。

**理由**：
- `package-service` 是中间产物的创建协调者，最清楚产生了哪些临时文件
- 调用方（`distribution-service`）只关心 `cleanup()` 这一个入口
- 避免清理逻辑散落在多个依赖注入的回调中

**替代方案**：
- 让 `downloadArtifact` 和 `decryptArtifact` 各自负责清理 → 拒绝，这些回调可能由外部提供，不应假设它们会清理
- 在 `distribution-service` 中清理 → 拒绝，违反关注点分离

### Decision 2: 中间产物追踪方式

**选择**：在 `validateAndExtract` 函数内部通过局部变量追踪中间产物，`cleanup()` 通过闭包访问，不修改 `PreparedSkillPackage` 类型。

```typescript
// 不改 PreparedSkillPackage 接口，用闭包追踪
const artifactPaths: string[] = [downloadedArtifact.artifactPath]

if (currentArtifact.artifactPath !== downloadedArtifact.artifactPath) {
  artifactPaths.push(currentArtifact.artifactPath)
}

return {
  skillId, name, version, extractedPath,
  async cleanup(): Promise<void> {
    await removePath(tempRoot)
    for (const path of artifactPaths) {
      try { await removePath(path) } catch { /* skip */ }
    }
  }
}
```

**理由**：
- `PreparedSkillPackage` 是公开类型（`types/index.ts`），`distribution-service.ts` 也依赖它，不应污染
- TypeScript 的 `_` 前缀只是约定，编译器不强制私有，调用方可随意访问
- 闭包天然封装了 `artifactPaths`，无需暴露到接口上
- `types/index.ts` 完全不需要修改

### Decision 3: 清理失败策略

| 场景 | 行为 | 日志 |
|------|------|------|
| 某个中间文件清理失败 | 继续清理其他文件，不抛出异常 | `console.warn` 输出路径和错误原因 |
| 所有清理都失败 | 不阻断主流程 | 每个失败单独 `console.warn` |
| 清理时文件已不存在 | 静默跳过（可能已被其他进程清理） | 无 |

**日志策略**：
- 使用 Electron main process 的 `console.warn`，无需引入额外日志框架
- 清理失败是运维信号，`warn` 级别足以引起注意但不会触发告警

**理由**：
- 清理是善后操作，不应影响主流程的成功/失败判断
- 分发成功后，即使临时文件残留，用户也可以手动清理
- 静默处理已不存在的文件避免不必要的错误

### Decision 4: 加密场景的处理

如果 `decryptArtifact` 返回的是**原地解密**（覆盖原文件），则：
- `downloadedArtifact.artifactPath` 和 `decryptedArtifact.artifactPath` 是同一个路径
- 去重后只记录一次

如果 `decryptArtifact` 返回的是**新文件解密**，则：
- 两个路径都需要记录
- 清理时按顺序删除

## Implementation Plan

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/core/distribution/package-service.ts` | 追踪中间产物，扩展 `cleanup()` 逻辑，覆盖异常路径 |

> `src/types/index.ts` 无需修改——`PreparedSkillPackage` 接口不变。

### 核心流程变更

**修改前**：
```typescript
return {
  skillId,
  name,
  version,
  extractedPath,
  async cleanup(): Promise<void> {
    await removePath(tempRoot)  // 只清理解压目录
  }
}
```

**修改后**：
```typescript
const artifactPaths: string[] = [downloadedArtifact.artifactPath]

// 如果解密产生新文件，记录解密产物
if (currentArtifact.artifactPath !== downloadedArtifact.artifactPath) {
  artifactPaths.push(currentArtifact.artifactPath)
}

// 提取中间产物的清理逻辑（catch 和 finally 共用）
async function cleanupArtifacts(): Promise<void> {
  await removePath(tempRoot)
  for (const path of artifactPaths) {
    try {
      await removePath(path)
    } catch (error) {
      console.warn(`Failed to clean up artifact: ${path}`, error)
    }
  }
}

const tempRoot = await createTempDirectory()
const extractedPath = join(tempRoot, "extracted")

try {
  await mkdir(extractedPath, { recursive: true })
  await dependencies.extractArtifact(currentArtifact, extractedPath, validatedRequest)

  if (dependencies.validateExtractedArtifact) {
    await dependencies.validateExtractedArtifact(extractedPath, validatedRequest)
  } else {
    await validateExtractedDirectory(extractedPath)
  }
} catch (error) {
  // 提取或验证失败时，也必须清理所有中间产物
  await cleanupArtifacts()
  throw error
}

return {
  skillId,
  name,
  version,
  extractedPath,
  async cleanup(): Promise<void> {
    await cleanupArtifacts()
  }
}
```

## Security Considerations

遵循 `core-beliefs.md` 原则：

### Principle 4: Fail Closed On Contract Gaps

- 清理失败不抛出异常，避免掩盖真正的分发错误
- 如果清理逻辑本身有 bug，不应影响分发结果的正确性

### 敏感数据残留

- 下载的技能包可能包含未加密的源代码
- 及时清理临时文件减少敏感数据在磁盘上的暴露时间
- 对于加密包，解密后的明文文件应优先清理

## Testing Strategy

### 单元测试

| 测试场景 | 验证点 |
|---------|--------|
| 正常流程（无加密） | 下载产物和 tempRoot 都被清理 |
| 加密流程（新文件解密） | 下载、解密、解压产物都被清理 |
| 加密流程（原地解密） | 不重复记录路径，清理一次 |
| 清理时文件已不存在 | 不抛出异常 |
| 清理部分失败 | 继续清理其他文件，`console.warn` 被调用 |
| 提取/验证失败 | catch 分支中所有中间产物也被清理 |
| `cleanup()` 被调用两次 | 不抛出异常（`force: true` 保证幂等） |
| 连续两次 `validateAndExtract` | 各自独立追踪 `artifactPaths`，互不干扰 |
| 磁盘满导致提取失败 | catch 中清理也失败，`console.warn` 被调用，原始错误仍被抛出 |

### 集成测试

- 完整分发流程后，检查临时目录是否为空
- 模拟磁盘权限问题，验证清理失败不阻断主流程

## Migration Notes

- 现有代码中 `cleanup()` 只清理 `tempRoot`，修改后会额外清理下载/解密产物
- 如果外部提供的 `downloadArtifact` 已经自行清理，`removePath` 会静默跳过不存在的文件
- `PreparedSkillPackage` 接口不变，`types/index.ts` 无需修改，无破坏性变更
- 提取/验证失败时的 catch 分支也会清理中间产物（当前只清理 `tempRoot`）
- 不需要数据迁移或 schema 变更

## Open Questions

> 以下问题需在实现前通过查看实际代码关闭。

1. **下载位置**：查看 `downloadArtifact` 的实际实现，确认产物路径。无论下载到 `cache/` 还是系统临时目录，清理逻辑不变——都通过 `artifactPaths` 追踪。
2. **解密实现**：查看 `decryptArtifact` 的实际实现。如果是原地解密，`artifactPaths` 去重逻辑会自动处理；如果是新文件解密，两个路径都会被记录。
3. ~~**日志级别**~~：已决定——清理失败使用 `console.warn` 输出路径和错误原因，见 Decision 3。

## References

- Core beliefs: `core-beliefs.md`
- Architecture: `../ARCHITECTURE.md`
- Package service: `../../src/core/distribution/package-service.ts`
- Distribution service: `../../src/core/distribution/distribution-service.ts`
