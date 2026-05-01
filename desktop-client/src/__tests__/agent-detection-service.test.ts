import { join, normalize } from "node:path"
import { describe, expect, it } from "vitest"

import { supportedAgentDefinitions, type AgentPathDefinition } from "@/adapters/agents/definitions"
import { createAgentDetectionService } from "@/core/detection/agent-detection-service"

const homeDir = normalize("C:/Users/Ada")

function resolveHomePath(pathValue: string): string {
  if (pathValue === "~") {
    return homeDir
  }

  if (pathValue.startsWith("~/")) {
    return normalize(join(homeDir, pathValue.slice(2)))
  }

  return normalize(pathValue)
}

function definition(id: AgentPathDefinition["id"]): AgentPathDefinition {
  const found = supportedAgentDefinitions.find((item) => item.id === id)

  if (!found) {
    throw new Error(`Missing definition: ${id}`)
  }

  return found
}

function createService(args: {
  definitions?: AgentPathDefinition[]
  existingPaths?: string[]
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
}) {
  const existingPaths = new Set((args.existingPaths ?? []).map((pathValue) => normalize(pathValue)))

  return createAgentDetectionService({
    definitions: args.definitions ?? supportedAgentDefinitions,
    env: args.env ?? {},
    homeDir: () => homeDir,
    now: () => new Date("2026-04-28T00:00:00.000Z"),
    platform: args.platform ?? "win32",
    pathExists: async (pathValue) => existingPaths.has(normalize(pathValue))
  })
}

describe("agent detection service", () => {
  it("auto-detects installed assistants from detection directories", async () => {
    const service = createService({
      definitions: [definition("claude-code"), definition("codex")],
      existingPaths: [resolveHomePath("~/.claude")]
    })

    const snapshot = await service.refresh()

    expect(snapshot.checkedAt).toBe("2026-04-28T00:00:00.000Z")
    expect(snapshot.supportedAgentCount).toBe(2)
    expect(snapshot.installedAgentIds).toEqual(["claude-code"])
    expect(snapshot.agentStatuses).toMatchObject([
      {
        agentId: "claude-code",
        installed: true,
        source: "auto-detected",
        targetPaths: [resolveHomePath("~/.claude/skills")]
      },
      {
        agentId: "codex",
        installed: false,
        source: "missing",
        targetPaths: []
      }
    ])
    expect(snapshot.uniqueTargets).toMatchObject([
      {
        targetPath: resolveHomePath("~/.claude/skills"),
        primaryAgentId: "claude-code",
        coveredAgentIds: ["claude-code"],
        source: "auto-detected"
      }
    ])
  })

  it("treats environment paths as explicit configured targets", async () => {
    const service = createService({
      definitions: [definition("cursor")],
      env: {
        OPEN_SKILLHUB_CURSOR_SKILLS_PATH: normalize("D:/Agents/Cursor/skills")
      }
    })

    const snapshot = await service.refresh()

    expect(snapshot.installedAgentIds).toEqual(["cursor"])
    expect(snapshot.agentStatuses[0]).toMatchObject({
      agentId: "cursor",
      installed: true,
      source: "environment",
      targetPaths: [normalize("D:/Agents/Cursor/skills")]
    })
    expect(snapshot.uniqueTargets[0]).toMatchObject({
      targetPath: normalize("D:/Agents/Cursor/skills"),
      primaryAgentId: "cursor",
      coveredAgentIds: ["cursor"],
      source: "environment"
    })
  })

  it("selects the first existing OpenClaw priority target", async () => {
    const service = createService({
      definitions: [definition("openclaw")],
      existingPaths: [resolveHomePath("~/.clawdbot/skills"), resolveHomePath("~/.moltbot/skills")]
    })

    const snapshot = await service.refresh()

    expect(snapshot.installedAgentIds).toEqual(["openclaw"])
    expect(snapshot.agentStatuses[0].targetPaths).toEqual([resolveHomePath("~/.clawdbot/skills")])
    expect(snapshot.uniqueTargets).toHaveLength(1)
    expect(snapshot.uniqueTargets[0].targetPath).toBe(resolveHomePath("~/.clawdbot/skills"))
  })

  it("deduplicates shared target paths while preserving covered assistants", async () => {
    const service = createService({
      definitions: [
        definition("cline"),
        definition("warp"),
        definition("codex"),
        definition("amp"),
        definition("kimi")
      ],
      existingPaths: [resolveHomePath("~/.agents"), resolveHomePath("~/.codex"), resolveHomePath("~/.config/agents")]
    })

    const snapshot = await service.refresh()

    expect(snapshot.installedAgentIds).toEqual(["cline", "warp", "codex", "amp", "kimi"])
    expect(snapshot.uniqueTargets).toMatchObject([
      {
        targetPath: resolveHomePath("~/.agents/skills"),
        primaryAgentId: "cline",
        coveredAgentIds: ["cline", "warp", "codex"],
        sharedPathKey: "agents-universal"
      },
      {
        targetPath: resolveHomePath("~/.config/agents/skills"),
        primaryAgentId: "amp",
        coveredAgentIds: ["amp", "kimi"],
        sharedPathKey: "config-agents"
      }
    ])
  })

  it("deduplicates Windows paths case-insensitively", async () => {
    const service = createService({
      definitions: [
        {
          ...definition("cline"),
          defaultTargets: [
            { path: "C:/Shared/Agents/skills", role: "primary", sharedPathKey: "case-test" }
          ]
        },
        {
          ...definition("warp"),
          defaultTargets: [
            { path: "c:/shared/agents/SKILLS", role: "primary", sharedPathKey: "case-test" }
          ]
        }
      ],
      existingPaths: [resolveHomePath("~/.agents")],
      platform: "win32"
    })

    const snapshot = await service.refresh()

    expect(snapshot.uniqueTargets).toHaveLength(1)
    expect(snapshot.uniqueTargets[0].coveredAgentIds).toEqual(["cline", "warp"])
  })
})
