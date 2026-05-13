import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createCliDistributionPlan } from "@/cli/services/cli-distribution-planner"
import type { CliDistributionTarget } from "@/cli/services/cli-targets"

describe("CLI distribution planner", () => {
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
    const root = join(tmpdir(), `skilldrive-cli-plan-${Math.random().toString(16).slice(2)}`)
    mkdirSync(root, { recursive: true })
    tempRoots.push(root)
    return root
  }

  function createTarget(targetPath: string, overrides: Partial<CliDistributionTarget> = {}): CliDistributionTarget {
    return {
      targetId: "target-codex",
      targetPath,
      primaryAgentId: "codex",
      coveredAgentIds: ["codex"],
      sharedPathKey: null,
      source: "auto-detected",
      skillLayout: { mode: "flat" },
      targetKey: `${targetPath}\0codex`,
      ...overrides
    }
  }

  it("resolves Hermes categorized destinations through target layout metadata", async () => {
    const root = createTempRoot()
    const plan = await createCliDistributionPlan({
      scope: { type: "global" },
      source: "local",
      command: "install",
      dryRun: true,
      package: {
        skillId: "local:Hermes-Skill",
        name: "Hermes-Skill",
        version: "1.0.0",
        contentHash: null
      },
      targets: [
        createTarget(join(root, "hermes", "skills"), {
          primaryAgentId: "hermes",
          coveredAgentIds: ["hermes"],
          skillLayout: {
            mode: "categorized",
            categoryDepth: 1,
            defaultCategory: "general",
            categorySource: "agent-default"
          }
        })
      ]
    })

    expect(plan.targets[0]).toMatchObject({
      status: "ready",
      destinationPath: join(root, "hermes", "skills", "general", "Hermes-Skill")
    })
  })

  it("fails local install closed on existing destination unless overwrite is set", async () => {
    const root = createTempRoot()
    const target = createTarget(join(root, "skills"))
    mkdirSync(join(root, "skills", "existing-skill"), { recursive: true })

    const blocked = await createCliDistributionPlan({
      scope: { type: "global" },
      source: "local",
      command: "install",
      dryRun: true,
      package: {
        skillId: "local:existing-skill",
        name: "existing-skill",
        version: null,
        contentHash: null
      },
      targets: [target]
    })

    expect(blocked.hasBlockingConflicts).toBe(true)
    expect(blocked.targets[0]?.status).toBe("conflict-existing")

    const overwrite = await createCliDistributionPlan({
      scope: { type: "global" },
      source: "local",
      command: "install",
      dryRun: false,
      overwrite: true,
      package: {
        skillId: "local:existing-skill",
        name: "existing-skill",
        version: null,
        contentHash: null
      },
      targets: [target]
    })

    expect(overwrite.hasBlockingConflicts).toBe(false)
    expect(overwrite.targets[0]?.status).toBe("ready")
    expect(overwrite.targets[0]?.overwrite).toBe(true)
  })

  it("distinguishes tracked sync updates from untracked same-name local conflicts", async () => {
    const root = createTempRoot()
    const target = createTarget(join(root, "skills"))
    mkdirSync(join(root, "skills", "server-skill"), { recursive: true })

    const untracked = await createCliDistributionPlan({
      scope: { type: "project", projectPath: "/repo/app" },
      source: "server",
      command: "sync",
      dryRun: true,
      package: {
        skillId: "remote-1",
        name: "server-skill",
        version: "2.0.0",
        contentHash: "hash-remote"
      },
      targets: [target],
      trackedRemoteSkillIdsByTargetKey: new Map()
    })

    expect(untracked.targets[0]?.status).toBe("conflict-local-existing")

    const tracked = await createCliDistributionPlan({
      scope: { type: "project", projectPath: "/repo/app" },
      source: "server",
      command: "sync",
      dryRun: false,
      package: {
        skillId: "remote-1",
        name: "server-skill",
        version: "2.0.0",
        contentHash: "hash-remote"
      },
      targets: [target],
      trackedRemoteSkillIdsByTargetKey: new Map([[target.targetKey, new Set(["remote-1"])]])
    })

    expect(tracked.targets[0]?.status).toBe("ready")
    expect(tracked.targets[0]?.overwrite).toBe(true)
  })
})
