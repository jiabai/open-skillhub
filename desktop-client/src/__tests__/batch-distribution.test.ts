import { describe, expect, it, vi } from "vitest"
import type {
  AgentPreDistributionCheckResult,
  PendingSyncUpdate,
  PreDistributionCheckSnapshot,
  SkillDistributionResult
} from "@/types"
import {
  createDefaultBatchSelection,
  getBatchEligibility,
  runDistributionBatch
} from "@/core/review/batch-distribution"

const updates: PendingSyncUpdate[] = [
  { remoteSkillId: "eligible", name: "Eligible", localVersion: null, localContentHash: null, remoteVersion: "1.0.0", remoteContentHash: null, reason: "not-installed" },
  { remoteSkillId: "installed", name: "Installed", localVersion: "1.0.0", localContentHash: "hash", remoteVersion: "1.0.0", remoteContentHash: "hash", reason: "update" },
  { remoteSkillId: "blocked", name: "Blocked", localVersion: null, localContentHash: null, remoteVersion: "1.0.0", remoteContentHash: null, reason: "not-installed" }
]

function check(agentId: string, contentComparison: AgentPreDistributionCheckResult["contentComparison"]): AgentPreDistributionCheckResult {
  return {
    agentId, displayName: agentId, skillDir: "/skills", exists: contentComparison === "installed",
    installedVersion: null, installedVersionSource: null, installedContentHash: null,
    remoteVersion: "1.0.0", remoteContentHash: null, installedVersionFormat: "unknown",
    remoteVersionFormat: "semver", contentComparison, checkedAt: "2026-01-01T00:00:00Z",
    durationMs: 1, errorCode: null, errorMessage: null
  }
}

function snapshot(overrides: Partial<PreDistributionCheckSnapshot> = {}): PreDistributionCheckSnapshot {
  return {
    results: {
      eligible: { "claude-code": check("claude-code", "not-installed") },
      installed: { "claude-code": check("claude-code", "installed") },
      blocked: { "claude-code": check("claude-code", "error") }
    }, checkedAt: "2026-01-01T00:00:00Z", expiresAt: "2026-01-02T00:00:00Z",
    pendingUpdateFingerprint: "", targetAgentIds: ["claude-code"], totalDurationMs: 1, globalErrors: [], ...overrides
  }
}

describe("batch distribution controller", () => {
  it("classifies fresh updates as eligible, installed, or blocked and selects stable eligible order", () => {
    const current = snapshot()
    expect(getBatchEligibility(updates[0], current, false)).toBe("eligible")
    expect(getBatchEligibility(updates[1], current, false)).toBe("installed")
    expect(getBatchEligibility(updates[2], current, false)).toBe("blocked")
    expect(createDefaultBatchSelection(updates, current, false)).toEqual(["eligible"])
  })

  it("blocks stale or absent snapshots, missing target results, and global errors", () => {
    expect(getBatchEligibility(updates[0], null, false)).toBe("blocked")
    expect(getBatchEligibility(updates[0], snapshot(), true)).toBe("blocked")
    expect(getBatchEligibility(updates[0], snapshot({ results: {} }), false)).toBe("blocked")
    expect(getBatchEligibility(updates[0], snapshot({ globalErrors: ["failed"] }), false)).toBe("blocked")
  })

  it("runs items sequentially, classifies partial and rejected results, and reports progress", async () => {
    const resultFor = (id: string, failedAgentIds: string[] = []): SkillDistributionResult => ({
      skillId: id, name: id, version: "1.0.0", extractedPath: null, targets: [],
      succeededAgentIds: [], failedAgentIds, syncedToLocalState: false
    })
    const seen: string[] = []
    const distribute = vi.fn(async (id: string) => {
      seen.push(id)
      if (id === "b") throw new Error("network down")
      return resultFor(id, id === "c" ? ["cursor"] : [])
    })
    const progress: unknown[] = []
    const result = await runDistributionBatch(["a", "b", "c"], distribute, (value) => progress.push(value))
    expect(seen).toEqual(["a", "b", "c"])
    expect(result.items.map((item) => [item.remoteSkillId, item.status])).toEqual([["a", "succeeded"], ["b", "failed"], ["c", "partial"]])
    expect(result.succeededCount).toBe(1)
    expect(result.partialCount).toBe(1)
    expect(result.failedCount).toBe(1)
    expect(progress).toEqual([
      { completed: 0, total: 3, currentSkillId: "a" },
      { completed: 1, total: 3, currentSkillId: "b" },
      { completed: 2, total: 3, currentSkillId: "c" },
      { completed: 3, total: 3, currentSkillId: null }
    ])
  })
})
