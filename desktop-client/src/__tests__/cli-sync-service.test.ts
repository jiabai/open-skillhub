import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { getAgentAdapter, hasAgentAdapter } from "@/adapters/agents/registry"
import type { AgentPathDefinition } from "@/adapters/agents/definitions"
import { runSyncCommand } from "@/cli/commands/sync"
import { CliError } from "@/cli/services/cli-errors"
import { createCliSyncStateStore } from "@/cli/services/cli-sync-state"
import { prepareCliLocalPackageSource } from "@/cli/services/cli-package-source"
import type { CliSyncApiClient } from "@/cli/services/cli-sync-service"
import { resolveCliDistributionTargets } from "@/cli/services/cli-targets"
import type { RemoteSkillSummary } from "@/types"

describe("CLI sync service", () => {
  const tempRoots: string[] = []
  const definitions: AgentPathDefinition[] = [
    {
      id: "codex",
      displayName: "Codex",
      detectionDirs: ["~/.codex"],
      defaultTargets: [{ path: "~/.agents/skills", role: "primary" }],
      projectTargets: [{ path: ".agents/skills", role: "primary" }],
      pathResolution: "all-owned"
    }
  ]

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createTempRoot(): string {
    const root = join(tmpdir(), `skilldrive-cli-sync-${Math.random().toString(16).slice(2)}`)
    mkdirSync(root, { recursive: true })
    tempRoots.push(root)
    return root
  }

  function createSkillPackage(root: string, name = "server-skill"): string {
    const packageRoot = join(root, name)
    mkdirSync(packageRoot, { recursive: true })
    writeFileSync(join(packageRoot, "SKILL.md"), `---\nname: ${name}\nversion: 2.0.0\n---\n# Skill`)
    writeFileSync(join(packageRoot, "README.md"), `remote ${name}`)
    return packageRoot
  }

  function createRemote(id: string, name: string, contentHash: string): RemoteSkillSummary {
    return {
      id,
      name,
      version: "2.0.0",
      contentHash,
      updatedAt: "2026-05-13T00:00:00.000Z"
    }
  }

  async function createApiClient(root: string, remoteSkills: RemoteSkillSummary[]): Promise<CliSyncApiClient> {
    return {
      listClientSkills: vi.fn(async () => remoteSkills),
      downloadSkillPackage: vi.fn(async (skill) =>
        prepareCliLocalPackageSource({
          sourcePath: createSkillPackage(root, skill.name),
          cacheDir: join(root, "cache")
        })
      )
    }
  }

  it("defaults to pending updates and supports --all", async () => {
    const root = createTempRoot()
    const stateStore = await createCliSyncStateStore(join(root, "state.sqlite3"))
    const targetOptions = {
      definitions,
      homeDir: () => root,
      platform: "win32" as const,
      pathExists: async () => true
    }
    const targetResolution = await resolveCliDistributionTargets({
      scope: { type: "global" },
      ...targetOptions
    })
    const remoteSkills = [
      createRemote("remote-installed", "installed-skill", "hash-installed"),
      createRemote("remote-missing", "missing-skill", "hash-missing")
    ]
    const apiClient = await createApiClient(root, remoteSkills)

    await stateStore.upsertRecord({
      scopeType: "global",
      scopeKey: "global",
      targetKey: targetResolution.targets[0].targetKey,
      agentId: "codex",
      remoteSkillId: "remote-installed",
      name: "installed-skill",
      installedVersion: "2.0.0",
      installedContentHash: "hash-installed",
      remoteVersion: "2.0.0",
      remoteContentHash: "hash-installed",
      lastSyncedAt: "2026-05-13T00:00:00.000Z"
    })

    const pendingOnly = await runSyncCommand({
      scope: { type: "global" },
      all: false,
      yes: false,
      cacheDir: join(root, "cache"),
      apiClient,
      stateStore,
      targetOptions,
      resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
    })

    expect(pendingOnly.plans.map((plan) => plan.package.skillId)).toEqual(["remote-missing"])

    const all = await runSyncCommand({
      scope: { type: "global" },
      all: true,
      yes: false,
      cacheDir: join(root, "cache"),
      apiClient,
      stateStore,
      targetOptions,
      resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
    })

    expect(all.plans.map((plan) => plan.package.skillId)).toEqual(["remote-installed", "remote-missing"])
    await stateStore.close()
  })

  it("writes server packages and updates scoped CLI sync state", async () => {
    const root = createTempRoot()
    const projectPath = join(root, "project")
    const stateStore = await createCliSyncStateStore(join(root, "state.sqlite3"))
    const apiClient = await createApiClient(root, [createRemote("remote-1", "server-skill", "hash-remote")])

    const result = await runSyncCommand({
      scope: { type: "project", projectPath },
      all: false,
      yes: true,
      cacheDir: join(root, "cache"),
      apiClient,
      stateStore,
      targetOptions: {
        definitions,
        platform: "win32"
      },
      resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null),
      now: () => "2026-05-13T03:00:00.000Z"
    })

    expect(result.exitCode).toBe(0)
    expect(readFileSync(join(projectPath, ".agents", "skills", "server-skill", "README.md"), "utf8")).toBe(
      "remote server-skill"
    )
    expect(await stateStore.listRecords({ scopeType: "project", scopeKey: projectPath })).toMatchObject([
      {
        remoteSkillId: "remote-1",
        installedContentHash: "hash-remote",
        scopeType: "project",
        scopeKey: projectPath
      }
    ])

    await stateStore.close()
  })

  it("fails closed on encrypted downloads before writing files", async () => {
    const root = createTempRoot()
    const stateStore = await createCliSyncStateStore(join(root, "state.sqlite3"))
    const apiClient: CliSyncApiClient = {
      listClientSkills: vi.fn(async () => [createRemote("remote-encrypted", "encrypted-skill", "hash")]),
      downloadSkillPackage: vi.fn(async () => {
        throw new CliError("unsupported-encrypted-download", "encrypted downloads not supported by Linux CLI v1")
      })
    }

    await expect(
      runSyncCommand({
        scope: { type: "global" },
        yes: true,
        cacheDir: join(root, "cache"),
        apiClient,
        stateStore,
        targetOptions: {
          definitions,
          homeDir: () => root,
          platform: "win32",
          pathExists: async () => true
        },
        resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
      })
    ).rejects.toMatchObject(new CliError("unsupported-encrypted-download", "encrypted downloads not supported by Linux CLI v1"))

    expect(existsSync(join(root, ".agents", "skills", "encrypted-skill"))).toBe(false)
    await stateStore.close()
  })

  it("maps API failures to remote CLI errors", async () => {
    const root = createTempRoot()
    const stateStore = await createCliSyncStateStore(join(root, "state.sqlite3"))
    const apiClient: CliSyncApiClient = {
      listClientSkills: vi.fn(async () => {
        throw new TypeError("fetch failed")
      }),
      downloadSkillPackage: vi.fn()
    }

    await expect(
      runSyncCommand({
        scope: { type: "global" },
        yes: false,
        cacheDir: join(root, "cache"),
        apiClient,
        stateStore,
        targetOptions: {
          definitions,
          homeDir: () => root,
          platform: "win32",
          pathExists: async () => true
        },
        resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
      })
    ).rejects.toMatchObject(new CliError("remote", "Failed to list server skills: fetch failed"))

    await stateStore.close()
  })
})
