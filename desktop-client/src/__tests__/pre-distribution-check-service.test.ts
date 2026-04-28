import { describe, expect, it, vi } from "vitest"

import { createPreDistributionCheckService } from "@/core/pre-distribution-check/pre-distribution-check-service"
import type {
  AgentId,
  DesktopSyncState,
  InstalledSkillMetadataV1,
  PendingSyncUpdate,
  StateStore
} from "@/types"

function createStateStore(pendingUpdates: PendingSyncUpdate[]): StateStore {
  const state: DesktopSyncState = {
    localRecords: [],
    pendingUpdates,
    successfulDistributionCount: 0,
    lastRefreshedAt: "2026-04-17T00:00:00.000Z"
  }

  return {
    readState: vi.fn(async () => state),
    writeState: vi.fn(),
    close: vi.fn()
  }
}

function createPendingUpdate(version = "1.0.0"): PendingSyncUpdate {
  return {
    remoteSkillId: "skill-a",
    name: "Skill A",
    localVersion: null,
    remoteVersion: version,
    reason: "missing-local-record"
  }
}

function createTarget(
  id: AgentId,
  displayName: string,
  readInstalledSkillMetadata: () => Promise<InstalledSkillMetadataV1>,
  coveredAgentIds: AgentId[] = [id]
) {
  return {
    adapter: {
      id,
      displayName,
      readInstalledSkillMetadata
    },
    coveredAdapters: coveredAgentIds.map((coveredAgentId) => ({
      id: coveredAgentId,
      displayName: coveredAgentId === id ? displayName : `Covered ${coveredAgentId}`
    })),
    installContext: {
      skillsPath: `C:\\skills\\${id}`
    },
    target: {
      targetId: `target-${id}`,
      targetPath: `C:\\skills\\${id}`,
      primaryAgentId: id,
      coveredAgentIds,
      sharedPathKey: coveredAgentIds.length > 1 ? "shared-target" : null,
      source: "auto-detected" as const
    }
  }
}

describe("pre-distribution check service", () => {
  it("returns an empty snapshot when there are no pending updates", async () => {
    const service = createPreDistributionCheckService({
      stateStore: createStateStore([]),
      targets: [],
      now: () => new Date("2026-04-17T00:00:00.000Z"),
      options: {
        snapshotTtlMs: 1000
      }
    })

    await expect(service.refresh()).resolves.toMatchObject({
      results: {},
      checkedAt: "2026-04-17T00:00:00.000Z",
      expiresAt: "2026-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "",
      targetAgentIds: [],
      globalErrors: []
    })
  })

  it("returns a global warning when no configured target agents exist", async () => {
    const service = createPreDistributionCheckService({
      stateStore: createStateStore([createPendingUpdate()]),
      targets: [],
      now: () => new Date("2026-04-17T00:00:00.000Z")
    })

    const snapshot = await service.refresh()

    expect(snapshot.results).toEqual({})
    expect(snapshot.pendingUpdateFingerprint).toBe("skill-a@1.0.0")
    expect(snapshot.globalErrors).toEqual([
      "No configured agent skill directories are available for pre-distribution checks."
    ])
  })

  it("compares installed metadata for configured targets", async () => {
    const service = createPreDistributionCheckService({
      stateStore: createStateStore([createPendingUpdate("1.0.0")]),
      targets: [
        createTarget("codex", "Codex", async () => ({
          exists: true,
          skillDir: "C:\\skills\\codex\\skill-a",
          version: "2.0.0",
          versionSource: "skill-frontmatter"
        })),
        createTarget("gemini-cli", "Gemini CLI", async () => ({
          exists: false,
          skillDir: "C:\\skills\\gemini-cli\\skill-a",
          version: null,
          versionSource: null
        }))
      ],
      now: () => new Date("2026-04-17T00:00:00.000Z")
    })

    const snapshot = await service.refresh()

    expect(snapshot.results["skill-a"]?.codex).toMatchObject({
      exists: true,
      installedVersion: "2.0.0",
      installedVersionSource: "skill-frontmatter",
      versionComparison: "installed-newer",
      errorCode: null
    })
    expect(snapshot.results["skill-a"]?.["gemini-cli"]).toMatchObject({
      exists: false,
      installedVersion: null,
      versionComparison: "not-installed"
    })
  })

  it("fans out one shared physical target result to every covered assistant", async () => {
    const readInstalledSkillMetadata = vi.fn(async () => ({
      exists: true,
      skillDir: "C:\\skills\\shared\\skill-a",
      version: "1.0.0",
      versionSource: "manifest-json" as const
    }))
    const service = createPreDistributionCheckService({
      stateStore: createStateStore([createPendingUpdate("1.0.0")]),
      targets: [
        createTarget("cline", "Cline", readInstalledSkillMetadata, ["cline", "warp"])
      ],
      now: () => new Date("2026-04-17T00:00:00.000Z")
    })

    const snapshot = await service.refresh()

    expect(readInstalledSkillMetadata).toHaveBeenCalledTimes(1)
    expect(snapshot.targetAgentIds).toEqual(["cline", "warp"])
    expect(snapshot.results["skill-a"]?.cline).toMatchObject({
      agentId: "cline",
      displayName: "Cline",
      versionComparison: "same"
    })
    expect(snapshot.results["skill-a"]?.warp).toMatchObject({
      agentId: "warp",
      displayName: "Covered warp",
      versionComparison: "same"
    })
  })

  it("keeps per-agent adapter failures inside the snapshot", async () => {
    const service = createPreDistributionCheckService({
      stateStore: createStateStore([createPendingUpdate()]),
      targets: [
        createTarget("codex", "Codex", async () => {
          throw new Error("path unreadable")
        })
      ],
      now: () => new Date("2026-04-17T00:00:00.000Z")
    })

    const snapshot = await service.refresh()

    expect(snapshot.results["skill-a"]?.codex).toMatchObject({
      versionComparison: "error",
      errorCode: "READ_FAILED",
      errorMessage: "path unreadable"
    })
  })

  it("preserves completed results when the total timeout occurs", async () => {
    const service = createPreDistributionCheckService({
      stateStore: createStateStore([createPendingUpdate()]),
      targets: [
        createTarget("codex", "Codex", async () => ({
          exists: true,
          skillDir: "C:\\skills\\codex\\skill-a",
          version: "0.9.0",
          versionSource: "manifest-json"
        })),
        createTarget(
          "claude-code",
          "Claude Code",
          () => new Promise<InstalledSkillMetadataV1>(() => undefined)
        )
      ],
      now: () => new Date("2026-04-17T00:00:00.000Z"),
      options: {
        maxConcurrentTargets: 2,
        targetTimeoutMs: 10_000,
        totalTimeoutMs: 1
      }
    })

    const snapshot = await service.refresh()

    expect(snapshot.results["skill-a"]?.codex).toMatchObject({
      versionComparison: "installed-older",
      errorCode: null
    })
    expect(snapshot.results["skill-a"]?.["claude-code"]).toMatchObject({
      versionComparison: "error",
      errorCode: "TIMEOUT"
    })
    expect(snapshot.globalErrors).toEqual([
      "Pre-distribution check timed out before all targets completed."
    ])
  })
})
