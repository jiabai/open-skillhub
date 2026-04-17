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
import type { DownloadedSkillArtifact } from "@/types"

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
    const root = mkdtempSync(join(tmpdir(), "open-skillhub-distribution-"))
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
      resolveInstallContext: (agentId: string) => {
        const skillsPath = skillsPathByAgent[agentId]

        return skillsPath ? { skillsPath } : null
      },
      skillsPathByAgent
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
    const { resolveAgentAdapter, resolveInstallContext, skillsPathByAgent } =
      createDistributionDependencies(rootDir)
    const distributionService = createDistributionService({
      packageService,
      stateStore,
      resolveAgentAdapter,
      resolveInstallContext,
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
      lastRefreshedAt: "2026-04-16T10:00:00.000Z"
    })

    const result = await distributionService.distribute({
      skillId: "skill-x",
      name: "Skill X",
      version: "1.0.0",
      packageSource: { source: packageSource },
      enabledAgentIds: ["codex", "claude-code"]
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
      { agentId: "codex", success: true, errorMessage: null },
      { agentId: "claude-code", success: true, errorMessage: null }
    ])
    expect(existsSync(result.extractedPath ?? "")).toBe(false)

    for (const agentId of ["codex", "claude-code"]) {
      const skillDir = join(skillsPathByAgent[agentId], "skill-x")
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
      encrypted: false
    })
    const { resolveAgentAdapter, resolveInstallContext, skillsPathByAgent } =
      createDistributionDependencies(rootDir)
    const distributionService = createDistributionService({
      packageService,
      stateStore,
      resolveAgentAdapter,
      resolveInstallContext
    })

    await stateStore.writeState({
      localRecords: [],
      pendingUpdates: [],
      lastRefreshedAt: "2026-04-16T10:00:00.000Z"
    })

    const result = await distributionService.distribute({
      skillId: "skill-y",
      name: "Skill Y",
      version: "1.0.0",
      packageSource: { source: packageSource },
      enabledAgentIds: ["codex", "missing-agent"]
    })

    expect(result.syncedToLocalState).toBe(false)
    expect(result.succeededAgentIds).toEqual(["codex"])
    expect(result.failedAgentIds).toEqual(["missing-agent"])
    expect(result.targets).toEqual([
      { agentId: "codex", success: true, errorMessage: null },
      {
        agentId: "missing-agent",
        success: false,
        errorMessage: "No adapter registered for agent: missing-agent"
      }
    ])

    expect(readFileSync(join(skillsPathByAgent.codex, "skill-y", "README.md"), "utf8")).toBe(
      "# Partial Install"
    )
    expect(await stateStore.readState()).toEqual({
      localRecords: [],
      pendingUpdates: [],
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
      },
      resolveInstallContext: () => {
        throw new Error("should not resolve install context without decryptor")
      }
    })

    await expect(
      distributionService.distribute({
        skillId: "skill-z",
        name: "Skill Z",
        version: "1.0.0",
        packageSource: { source: packageSource },
        enabledAgentIds: ["codex"]
      })
    ).rejects.toThrow(
      "Encrypted skill packages require a decryptArtifact dependency before distribution"
    )

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
          { agentId: "codex", success: true, errorMessage: null },
          { agentId: "claude-code", success: true, errorMessage: null }
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
          { agentId: "codex", success: true, errorMessage: null },
          { agentId: "missing-agent", success: false, errorMessage: "No adapter registered" }
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
