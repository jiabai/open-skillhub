import { describe, expect, it } from "vitest"

import { resolveCliDistributionTargets } from "@/cli/services/cli-targets"
import { CliError } from "@/cli/services/cli-errors"
import type { AgentPathDefinition } from "@/adapters/agents/definitions"

describe("CLI target resolution", () => {
  const definitions: AgentPathDefinition[] = [
    {
      id: "codex",
      displayName: "Codex",
      detectionDirs: ["~/.codex"],
      defaultTargets: [
        { path: "~/.agents/skills", role: "primary", sharedPathKey: "agents-universal" }
      ],
      projectTargets: [
        { path: ".agents/skills", role: "primary", sharedPathKey: "agents-universal" }
      ],
      pathResolution: "all-owned"
    },
    {
      id: "warp",
      displayName: "Warp",
      detectionDirs: ["~/.agents"],
      defaultTargets: [
        { path: "~/.agents/skills", role: "primary", sharedPathKey: "agents-universal" }
      ],
      projectTargets: [
        { path: ".agents/skills", role: "primary", sharedPathKey: "agents-universal" }
      ],
      pathResolution: "all-owned"
    },
    {
      id: "cursor",
      displayName: "Cursor",
      detectionDirs: ["~/.cursor"],
      defaultTargets: [{ path: "~/.cursor/skills", role: "primary" }],
      projectTargets: [{ path: ".codex/skills", role: "compatible-read" }],
      pathResolution: "all-owned"
    },
    {
      id: "hermes",
      displayName: "Hermes Agent",
      detectionDirs: ["~/.hermes"],
      defaultTargets: [
        {
          path: "~/.hermes/skills",
          role: "primary",
          skillLayout: {
            mode: "categorized",
            categoryDepth: 1,
            defaultCategory: "general",
            categorySource: "agent-default"
          }
        }
      ],
      pathResolution: "all-owned"
    }
  ]

  it("resolves global detected/configured writable targets and dedupes shared paths", async () => {
    const result = await resolveCliDistributionTargets({
      scope: { type: "global" },
      definitions,
      homeDir: () => "/home/test",
      platform: "linux",
      pathExists: async () => true,
      agentPathsConfig: {
        hermes: { targetPath: "~/custom-hermes/skills" }
      }
    })

    expect(result.targets.map((target) => target.primaryAgentId)).toContain("codex")
    expect(result.targets.find((target) => target.primaryAgentId === "codex")?.coveredAgentIds).toEqual([
      "codex",
      "warp"
    ])
    expect(result.targets.find((target) => target.primaryAgentId === "hermes")?.targetPath).toBe(
      "/home/test/custom-hermes/skills"
    )
    expect(result.targets.find((target) => target.primaryAgentId === "hermes")?.skillLayout).toEqual({
      mode: "categorized",
      categoryDepth: 1,
      defaultCategory: "general",
      categorySource: "agent-default"
    })
  })

  it("resolves explicit project targets and excludes compatible-read-only targets", async () => {
    const result = await resolveCliDistributionTargets({
      scope: { type: "project", projectPath: "/repo/app" },
      definitions,
      platform: "linux"
    })

    expect(result.targets).toHaveLength(1)
    expect(result.targets[0]).toMatchObject({
      targetPath: "/repo/app/.agents/skills",
      primaryAgentId: "codex",
      coveredAgentIds: ["codex", "warp"]
    })
    expect(result.targets[0]?.coveredAgentIds).not.toContain("cursor")
  })

  it("applies agent filters and reports no-targets with exit-code-ready errors", async () => {
    await expect(
      resolveCliDistributionTargets({
        scope: { type: "project", projectPath: "/repo/app" },
        definitions,
        platform: "linux",
        agentFilter: ["hermes"]
      })
    ).rejects.toMatchObject(new CliError("no-targets", "No writable SkillDrive targets matched the request"))
  })
})
