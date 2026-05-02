import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { getAgentAdapter, hasAgentAdapter } from "@/adapters/agents/registry"
import {
  createDistributionNotification,
  createDistributionService
} from "@/core/distribution/distribution-service"
import { createPackageService } from "@/core/distribution/package-service"
import { createSqliteStateStore } from "@/core/storage/state-db"
import type { AgentId, DownloadedSkillArtifact, SkillDistributionTarget } from "@/types"

describe("distribution pipeline", () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createTempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "skilldrive-distribution-"))
    tempRoots.push(root)
    return root
  }

  function copyDirectoryContentsSync(sourcePath: string, targetPath: string): void {
    mkdirSync(targetPath, { recursive: true })

    for (const entry of readdirSync(sourcePath, { withFileTypes: true })) {
      const sourceEntryPath = join(sourcePath, entry.name)
      const targetEntryPath = join(targetPath, entry.name)

      if (entry.isDirectory()) {
        copyDirectoryContentsSync(sourceEntryPath, targetEntryPath)
        continue
      }

      if (entry.isFile()) {
        copyFileSync(sourceEntryPath, targetEntryPath)
      }
    }
  }

  function createPackageSource(rootDir: string, content = "# Distributed Skill"): string {
    const sourceDir = join(rootDir, "package-source")
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, "README.md"), content)
    writeFileSync(join(sourceDir, "manifest.json"), JSON.stringify({ name: "skill-x" }))
    return sourceDir
  }

  function buildPackageService(artifact: DownloadedSkillArtifact) {
    const downloadArtifact = vi.fn(async () => artifact)

    return {
      service: createPackageService({
        downloadArtifact,
        extractArtifact: async (downloadedArtifact, extractedPath) => {
          copyDirectoryContentsSync(downloadedArtifact.artifactPath, extractedPath)
        }
      }),
      downloadArtifact
    }
  }

  function createDistributionDependencies(rootDir: string) {
    const skillsPathByAgent: Record<string, string> = {
      codex: join(rootDir, "skills", "codex"),
      "claude-code": join(rootDir, "skills", "claude-code"),
      "gemini-cli": join(rootDir, "skills", "gemini-cli")
    }

    return {
      resolveAgentAdapter: (agentId: string) =>
        hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null,
      skillsPathByAgent
    }
  }

  function createTarget(
    agentId: AgentId,
    targetPath: string,
    coveredAgentIds: AgentId[] = [agentId],
    writeMode: SkillDistributionTarget["writeMode"] = "write"
  ): SkillDistributionTarget {
    return {
      targetId: `target-${agentId}`,
      targetPath,
      primaryAgentId: agentId,
      coveredAgentIds,
      sharedPathKey: coveredAgentIds.length > 1 ? "shared-target" : null,
      source: "auto-detected",
      writeMode
    }
  }

  it("distributes a validated package to all enabled agents and commits sync state", async () => {
    const rootDir = createTempRoot()
    const dbPath = join(rootDir, "state", "state.sqlite3")
    const stateStore = await createSqliteStateStore(dbPath)
    const packageSource = createPackageSource(rootDir)
    const { service: packageService, downloadArtifact } = buildPackageService({
      artifactPath: packageSource,
      encrypted: false
    })
    const { resolveAgentAdapter, skillsPathByAgent } =
      createDistributionDependencies(rootDir)
    const distributionService = createDistributionService({
      packageService,
      stateStore,
      resolveAgentAdapter,
      now: () => "2026-04-17T10:00:00.000Z"
    })

    await stateStore.writeState({
      localRecords: [
        {
          remoteSkillId: "legacy-skill",
          name: "Legacy Skill",
          installedVersion: "0.1.0",
          remoteVersion: "0.1.0",
          lastComparedAt: "2026-04-16T10:00:00.000Z"
        }
      ],
      pendingUpdates: [
        {
          remoteSkillId: "skill-x",
          name: "Skill X",
          localVersion: "0.9.0",
          remoteVersion: "1.0.0",
          reason: "version-mismatch"
        },
        {
          remoteSkillId: "other-skill",
          name: "Other Skill",
          localVersion: null,
          remoteVersion: "2.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-16T10:00:00.000Z"
    })

    const result = await distributionService.distribute({
      skillId: "skill-x",
      name: "Skill X",
      version: "1.0.0",
      packageSource: { source: packageSource },
      targets: [
        createTarget("codex", skillsPathByAgent.codex),
        createTarget("claude-code", skillsPathByAgent["claude-code"])
      ]
    })

    expect(downloadArtifact).toHaveBeenCalledWith({
      skillId: "skill-x",
      name: "Skill X",
      version: "1.0.0",
      packageSource: { source: packageSource }
    })
    expect(result.syncedToLocalState).toBe(true)
    expect(result.succeededAgentIds).toEqual(["codex", "claude-code"])
    expect(result.failedAgentIds).toEqual([])
    expect(result.targets).toEqual([
      {
        agentId: "codex",
        targetPath: skillsPathByAgent.codex,
        status: "success",
        success: true,
        errorMessage: null
      },
      {
        agentId: "claude-code",
        targetPath: skillsPathByAgent["claude-code"],
        status: "success",
        success: true,
        errorMessage: null
      }
    ])
    expect(existsSync(result.extractedPath ?? "")).toBe(false)
    expect(existsSync(packageSource)).toBe(true)

    for (const agentId of ["codex", "claude-code"]) {
      const skillDir = join(skillsPathByAgent[agentId], "Skill X")
      expect(readFileSync(join(skillDir, "README.md"), "utf8")).toBe("# Distributed Skill")
      expect(readFileSync(join(skillDir, "manifest.json"), "utf8")).toBe(
        JSON.stringify({ name: "skill-x" })
      )
    }

    expect(await stateStore.readState()).toEqual({
      localRecords: [
        {
          remoteSkillId: "legacy-skill",
          name: "Legacy Skill",
          installedVersion: "0.1.0",
          remoteVersion: "0.1.0",
          lastComparedAt: "2026-04-16T10:00:00.000Z"
        },
        {
          remoteSkillId: "skill-x",
          name: "Skill X",
          installedVersion: "1.0.0",
          remoteVersion: "1.0.0",
          lastComparedAt: "2026-04-17T10:00:00.000Z"
        }
      ],
      pendingUpdates: [
        {
          remoteSkillId: "other-skill",
          name: "Other Skill",
          localVersion: null,
          remoteVersion: "2.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 1,
      lastRefreshedAt: "2026-04-16T10:00:00.000Z"
    })

    await stateStore.close()
  })

  it("reports per-target failures without committing sync state", async () => {
    const rootDir = createTempRoot()
    const dbPath = join(rootDir, "state", "state.sqlite3")
    const stateStore = await createSqliteStateStore(dbPath)
    const packageSource = createPackageSource(rootDir, "# Partial Install")
    const { service: packageService } = buildPackageService({
      artifactPath: packageSource,
      encrypted: false,
      cleanupPaths: [packageSource]
    })
    const { resolveAgentAdapter, skillsPathByAgent } =
      createDistributionDependencies(rootDir)
    const distributionService = createDistributionService({
      packageService,
      stateStore,
      resolveAgentAdapter
    })

    await stateStore.writeState({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-16T10:00:00.000Z"
    })

    const result = await distributionService.distribute({
      skillId: "skill-y",
      name: "Skill Y",
      version: "1.0.0",
      packageSource: { source: packageSource },
      targets: [
        createTarget("codex", skillsPathByAgent.codex),
        {
          targetId: "target-missing",
          targetPath: join(rootDir, "skills", "missing-agent"),
          primaryAgentId: "codex",
          coveredAgentIds: ["codex"],
          sharedPathKey: null,
          source: "auto-detected",
          writeMode: "write",
          adapterAgentId: "missing-agent"
        }
      ]
    })

    expect(result.syncedToLocalState).toBe(false)
    expect(result.succeededAgentIds).toEqual(["codex"])
    expect(result.failedAgentIds).toEqual(["missing-agent"])
    expect(result.targets).toEqual([
      {
        agentId: "codex",
        targetPath: skillsPathByAgent.codex,
        status: "success",
        success: true,
        errorMessage: null
      },
      {
        agentId: "missing-agent",
        targetPath: join(rootDir, "skills", "missing-agent"),
        status: "failed",
        success: false,
        errorMessage: "No adapter registered for agent: missing-agent"
      }
    ])

    expect(readFileSync(join(skillsPathByAgent.codex, "Skill Y", "README.md"), "utf8")).toBe(
      "# Partial Install"
    )
    expect(existsSync(packageSource)).toBe(false)
    expect(await stateStore.readState()).toEqual({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-16T10:00:00.000Z"
    })

    await stateStore.close()
  })

  it("fails fast when an encrypted package has no decryptor boundary", async () => {
    const rootDir = createTempRoot()
    const dbPath = join(rootDir, "state", "state.sqlite3")
    const stateStore = await createSqliteStateStore(dbPath)
    const packageSource = createPackageSource(rootDir, "# Encrypted Skill")
    const { service: packageService } = buildPackageService({
      artifactPath: packageSource,
      encrypted: true
    })
    const distributionService = createDistributionService({
      packageService,
      stateStore,
      resolveAgentAdapter: () => {
        throw new Error("should not install encrypted packages without decryptor")
      }
    })

    await expect(
      distributionService.distribute({
        skillId: "skill-z",
        name: "Skill Z",
        version: "1.0.0",
        packageSource: { source: packageSource },
        targets: [createTarget("codex", join(rootDir, "skills", "codex"))]
      })
    ).rejects.toThrow(
      "Encrypted skill packages require a decryptArtifact dependency before distribution"
    )

    await stateStore.close()
  })

  it("writes a shared physical target once and marks covered assistants", async () => {
    const rootDir = createTempRoot()
    const dbPath = join(rootDir, "state", "state.sqlite3")
    const stateStore = await createSqliteStateStore(dbPath)
    const packageSource = createPackageSource(rootDir)
    const { service: packageService } = buildPackageService({
      artifactPath: packageSource,
      encrypted: false
    })
    const sharedSkillsPath = join(rootDir, "skills", "shared-agents")
    const distributionService = createDistributionService({
      packageService,
      stateStore,
      resolveAgentAdapter: (agentId: string) =>
        hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null,
      now: () => "2026-04-17T10:00:00.000Z"
    })

    await stateStore.writeState({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-shared",
          name: "Skill Shared",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-16T10:00:00.000Z"
    })

    const result = await distributionService.distribute({
      skillId: "skill-shared",
      name: "Skill Shared",
      version: "1.0.0",
      packageSource: { source: packageSource },
      targets: [createTarget("cline", sharedSkillsPath, ["cline", "warp"])]
    })

    expect(readFileSync(join(sharedSkillsPath, "Skill Shared", "README.md"), "utf8")).toBe(
      "# Distributed Skill"
    )
    expect(result.succeededAgentIds).toEqual(["cline", "warp"])
    expect(result.targets).toEqual([
      {
        agentId: "cline",
        targetPath: sharedSkillsPath,
        status: "success",
        success: true,
        errorMessage: null
      },
      {
        agentId: "warp",
        targetPath: sharedSkillsPath,
        status: "covered-by-shared-path",
        success: true,
        errorMessage: null
      }
    ])
    expect((await stateStore.readState()).pendingUpdates).toEqual([])

    await stateStore.close()
  })

  it("skips same-version targets without downloading a package and reconciles local state", async () => {
    const rootDir = createTempRoot()
    const dbPath = join(rootDir, "state", "state.sqlite3")
    const stateStore = await createSqliteStateStore(dbPath)
    const packageSource = createPackageSource(rootDir)
    const { service: packageService, downloadArtifact } = buildPackageService({
      artifactPath: packageSource,
      encrypted: false
    })
    const skillsPath = join(rootDir, "skills", "codex")
    const distributionService = createDistributionService({
      packageService,
      stateStore,
      resolveAgentAdapter: (agentId: string) =>
        hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null,
      now: () => "2026-04-17T10:00:00.000Z"
    })

    await stateStore.writeState({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-same",
          name: "Skill Same",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-16T10:00:00.000Z"
    })

    const result = await distributionService.distribute({
      skillId: "skill-same",
      name: "Skill Same",
      version: "1.0.0",
      packageSource: { source: packageSource },
      targets: [createTarget("codex", skillsPath, ["codex"], "skip-same-version")]
    })

    expect(downloadArtifact).not.toHaveBeenCalled()
    expect(existsSync(join(skillsPath, "Skill Same"))).toBe(false)
    expect(result.targets).toEqual([
      {
        agentId: "codex",
        targetPath: skillsPath,
        status: "skipped-same-version",
        success: true,
        errorMessage: null
      }
    ])
    expect(result.syncedToLocalState).toBe(true)
    expect(await stateStore.readState()).toMatchObject({
      localRecords: [
        {
          remoteSkillId: "skill-same",
          name: "Skill Same",
          installedVersion: "1.0.0",
          remoteVersion: "1.0.0",
          lastComparedAt: "2026-04-17T10:00:00.000Z"
        }
      ],
      pendingUpdates: [],
      successfulDistributionCount: 1
    })

    await stateStore.close()
  })

  it("summarizes successful and partial distributions for tray notifications", () => {
    expect(
      createDistributionNotification({
        skillId: "skill-a",
        name: "Skill A",
        version: "1.0.0",
        extractedPath: null,
        targets: [
          {
            agentId: "codex",
            targetPath: "C:\\skills\\codex",
            status: "success",
            success: true,
            errorMessage: null
          },
          {
            agentId: "claude-code",
            targetPath: "C:\\skills\\claude",
            status: "success",
            success: true,
            errorMessage: null
          }
        ],
        succeededAgentIds: ["codex", "claude-code"],
        failedAgentIds: [],
        syncedToLocalState: true
      })
    ).toEqual({
      title: "Skill distributed successfully",
      body: "Skill A was distributed to 2 agent targets.",
      tone: "success"
    })

    expect(
      createDistributionNotification({
        skillId: "skill-b",
        name: "Skill B",
        version: "1.0.0",
        extractedPath: null,
        targets: [
          {
            agentId: "codex",
            targetPath: "C:\\skills\\codex",
            status: "success",
            success: true,
            errorMessage: null
          },
          {
            agentId: "missing-agent",
            targetPath: "C:\\skills\\missing-agent",
            status: "failed",
            success: false,
            errorMessage: "No adapter registered"
          }
        ],
        succeededAgentIds: ["codex"],
        failedAgentIds: ["missing-agent"],
        syncedToLocalState: false
      })
    ).toEqual({
      title: "Skill distribution completed with warnings",
      body: "Skill B reached 1 target and failed on 1.",
      tone: "warning"
    })
  })
})
