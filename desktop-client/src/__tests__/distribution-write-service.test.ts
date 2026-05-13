import { describe, expect, it, vi } from "vitest"

import type { AgentAdapterV1, AgentInstallContextV1, InstalledSkillV1 } from "@/adapters/agents/base"
import { createDistributionWriteService } from "@/core/distribution/distribution-write-service"
import type { PreparedSkillPackage, SkillDistributionTarget } from "@/types"

describe("distribution write service", () => {
  const preparedPackage: PreparedSkillPackage = {
    skillId: "skill-1",
    name: "Skill One",
    version: "1.0.0",
    extractedPath: "/tmp/extracted",
    cleanup: async () => undefined
  }

  function createTarget(overrides: Partial<SkillDistributionTarget> = {}): SkillDistributionTarget {
    return {
      targetId: "target-codex",
      targetPath: "/home/test/.agents/skills",
      primaryAgentId: "codex",
      coveredAgentIds: ["codex"],
      sharedPathKey: null,
      source: "auto-detected",
      ...overrides
    }
  }

  it("writes through adapters, verifies installs, and propagates skill layout", async () => {
    const installed: InstalledSkillV1 = {
      skillDir: "/home/test/.hermes/skills/general/Skill One",
      filePaths: ["SKILL.md"]
    }
    const installSkill = vi.fn(async () => installed)
    const verifyInstalledSkill = vi.fn(async () => true)
    const adapter: AgentAdapterV1 = {
      id: "hermes",
      displayName: "Hermes Agent",
      installSkill,
      verifyInstalledSkill,
      readInstalledSkillMetadata: vi.fn()
    }
    const service = createDistributionWriteService({
      resolveAgentAdapter: () => adapter
    })

    const result = await service.write({
      preparedPackage,
      targets: [
        createTarget({
          primaryAgentId: "hermes",
          coveredAgentIds: ["hermes"],
          targetPath: "/home/test/.hermes/skills",
          skillLayout: {
            mode: "categorized",
            categoryDepth: 1,
            defaultCategory: "general",
            categorySource: "agent-default"
          }
        })
      ]
    })

    expect(installSkill).toHaveBeenCalledWith(preparedPackage, {
      skillsPath: "/home/test/.hermes/skills",
      skillLayout: {
        mode: "categorized",
        categoryDepth: 1,
        defaultCategory: "general",
        categorySource: "agent-default"
      }
    } satisfies AgentInstallContextV1)
    expect(verifyInstalledSkill).toHaveBeenCalledWith(preparedPackage, installed)
    expect(result.allSucceeded).toBe(true)
    expect(result.succeededAgentIds).toEqual(["hermes"])
  })

  it("reports shared targets and adapter lookup failures without throwing", async () => {
    const service = createDistributionWriteService({
      resolveAgentAdapter: (agentId) =>
        agentId === "missing"
          ? null
          : {
              id: "codex",
              displayName: "Codex",
              installSkill: vi.fn(async () => ({ skillDir: "/installed", filePaths: ["SKILL.md"] })),
              verifyInstalledSkill: vi.fn(async () => true),
              readInstalledSkillMetadata: vi.fn()
            }
    })

    const result = await service.write({
      preparedPackage,
      targets: [
        createTarget({ coveredAgentIds: ["codex", "warp"] }),
        createTarget({
          targetId: "missing-target",
          targetPath: "/missing",
          adapterAgentId: "missing"
        })
      ]
    })

    expect(result.allSucceeded).toBe(false)
    expect(result.targets).toEqual([
      {
        agentId: "codex",
        targetPath: "/home/test/.agents/skills",
        status: "success",
        success: true,
        errorMessage: null
      },
      {
        agentId: "warp",
        targetPath: "/home/test/.agents/skills",
        status: "covered-by-shared-path",
        success: true,
        errorMessage: null
      },
      {
        agentId: "missing",
        targetPath: "/missing",
        status: "failed",
        success: false,
        errorMessage: "No adapter registered for agent: missing"
      }
    ])
  })
})
