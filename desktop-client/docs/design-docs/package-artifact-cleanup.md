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

**选择**：在 `PreparedSkillPackage` 内部增加 `_artifactPaths` 字段（内部使用，不暴露给调用方）。

```typescript
interface PreparedSkillPackage {
  skillId: string
  name: string
  version: string | null
  extractedPath: string
  cleanup(): Promise<void>
  // 内部字段，追踪所有需要清理的中间路径
  _artifactPaths: string[]
}
```

**理由**：
- 最小侵入性，不改变现有公开接口
- 所有清理路径集中管理
- `_` 前缀明确表示这是内部实现细节

### Decision 3: 清理失败策略

| 场景 | 行为 |
|------|------|
| 某个中间文件清理失败 | 记录错误，继续清理其他文件，不抛出异常 |
| 所有清理都失败 | 记录错误日志，不阻断主流程 |
| 清理时文件已不存在 | 静默跳过（可能已被其他进程清理） |

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
| `src/types/index.ts` | `PreparedSkillPackage` 增加 `_artifactPaths` 字段 |
| `src/core/distribution/package-service.ts` | 追踪中间产物，扩展 `cleanup()` 逻辑 |

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
const artifactPaths: string[] = []

// 记录下载产物
artifactPaths.push(downloadedArtifact.artifactPath)

// 如果解密产生新文件，记录解密产物
if (currentArtifact.artifactPath !== downloadedArtifact.artifactPath) {
  artifactPaths.push(currentArtifact.artifactPath)
}

return {
  skillId,
  name,
  version,
  extractedPath,
  _artifactPaths: artifactPaths,
  async cleanup(): Promise<void> {
    // 先清理解压目录
    await removePath(tempRoot)
    // 再清理所有中间产物
    for (const path of artifactPaths) {
      try {
        await removePath(path)
      } catch {
        // 清理失败不阻断，静默跳过
      }
    }
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
| 清理部分失败 | 继续清理其他文件，不阻断 |

### 集成测试

- 完整分发流程后，检查临时目录是否为空
- 模拟磁盘权限问题，验证清理失败不阻断主流程

## Migration Notes

- 现有代码中 `cleanup()` 只清理 `tempRoot`，修改后会额外清理下载/解密产物
- 如果外部提供的 `downloadArtifact` 已经自行清理，`removePath` 会静默跳过不存在的文件
- 不需要数据迁移或 schema 变更

## Open Questions

1. **下载位置**：当前 `downloadArtifact` 的实现将文件下载到哪里？是 `cache/` 还是系统临时目录？
2. **解密实现**：`decryptArtifact` 是原地解密还是生成新文件？
3. **日志级别**：清理失败时是否需要记录警告日志？记录到哪里？

## References

- Core beliefs: `core-beliefs.md`
- Architecture: `../ARCHITECTURE.md`
- Package service: `../../src/core/distribution/package-service.ts`
- Distribution service: `../../src/core/distribution/distribution-service.ts`
