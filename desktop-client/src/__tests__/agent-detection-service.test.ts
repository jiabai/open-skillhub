import { join, normalize } from "node:path"
import { describe, expect, it } from "vitest"

import { supportedAgentDefinitions, type AgentPathDefinition } from "@/adapters/agents/definitions"
import { createAgentDetectionService } from "@/core/detection/agent-detection-service"
import type { AgentPathsConfig } from "@/types"

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
  agentPathsConfig?: AgentPathsConfig
  definitions?: AgentPathDefinition[]
  existingPaths?: string[]
  platform?: NodeJS.Platform
}) {
  const existingPaths = new Set((args.existingPaths ?? []).map((pathValue) => normalize(pathValue)))

  return createAgentDetectionService({
    agentPathsConfig: args.agentPathsConfig,
    definitions: args.definitions ?? supportedAgentDefinitions,
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

  it("treats JSON configured paths as explicit configured targets", async () => {
    const service = createService({
      definitions: [definition("cursor")],
      agentPathsConfig: {
        cursor: {
          targetPath: "D:/Agents/Cursor/skills"
        }
      }
    })

    const snapshot = await service.refresh()

    expect(snapshot.installedAgentIds).toEqual(["cursor"])
    expect(snapshot.agentStatuses[0]).toMatchObject({
      agentId: "cursor",
      installed: true,
      source: "auto-detected",
      targetPaths: [normalize("D:/Agents/Cursor/skills")]
    })
    expect(snapshot.uniqueTargets[0]).toMatchObject({
      targetPath: normalize("D:/Agents/Cursor/skills"),
      primaryAgentId: "cursor",
      coveredAgentIds: ["cursor"],
      source: "auto-detected"
    })
  })

  it("preserves categorized Hermes layout on detected and configured targets", async () => {
    const detected = await createService({
      definitions: [definition("hermes")],
      existingPaths: [resolveHomePath("~/.hermes")]
    }).refresh()

    expect(detected.uniqueTargets[0]).toMatchObject({
      targetPath: resolveHomePath("~/.hermes/skills"),
      primaryAgentId: "hermes",
      skillLayout: {
        mode: "categorized",
        categoryDepth: 1,
        defaultCategory: "general",
        categorySource: "agent-default"
      }
    })

    const configured = await createService({
      definitions: [definition("hermes")],
      agentPathsConfig: {
        hermes: {
          targetPath: "D:/Hermes/skills"
        }
      }
    }).refresh()

    expect(configured.uniqueTargets[0]).toMatchObject({
      targetPath: normalize("D:/Hermes/skills"),
      primaryAgentId: "hermes",
      skillLayout: {
        mode: "categorized",
        categoryDepth: 1,
        defaultCategory: "general",
        categorySource: "agent-default"
      }
    })
  })

  it("ignores invalid JSON configured paths and falls back to missing", async () => {
    const service = createService({
      definitions: [definition("cursor"), definition("codex")],
      agentPathsConfig: {
        cursor: {
          targetPath: "../escape"
        },
        codex: {
          targetPath: "relative/skills"
        }
      }
    })

    const snapshot = await service.refresh()

    expect(snapshot.installedAgentIds).toEqual([])
    expect(snapshot.agentStatuses).toMatchObject([
      {
        agentId: "cursor",
        installed: false,
        source: "missing",
        targetPaths: []
      },
      {
        agentId: "codex",
        installed: false,
        source: "missing",
        targetPaths: []
      }
    ])
    expect(snapshot.uniqueTargets).toEqual([])
  })

  it("deduplicates JSON configured shared targets while preserving coverage", async () => {
    const service = createService({
      definitions: [definition("cline"), definition("codex")],
      agentPathsConfig: {
        cline: {
          targetPath: "D:/Agents/shared-skills"
        },
        codex: {
          targetPath: "D:/Agents/shared-skills"
        }
      }
    })

    const snapshot = await service.refresh()

    expect(snapshot.installedAgentIds).toEqual(["cline", "codex"])
    expect(snapshot.uniqueTargets).toHaveLength(1)
    expect(snapshot.uniqueTargets[0]).toMatchObject({
      targetPath: normalize("D:/Agents/shared-skills"),
      primaryAgentId: "cline",
      coveredAgentIds: ["cline", "codex"],
      sharedPathKey: "agents-universal",
      source: "auto-detected"
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

  it("auto-detects QwenWork CN and targets its skills directory", async () => {
    const snapshot = await createService({
      definitions: [definition("qwenworkcn")],
      existingPaths: [resolveHomePath("~/.qwenworkcn")]
    }).refresh()

    expect(snapshot.installedAgentIds).toEqual(["qwenworkcn"])
    expect(snapshot.agentStatuses[0].targetPaths).toEqual([resolveHomePath("~/.qwenworkcn/skills")])
    expect(snapshot.uniqueTargets[0]).toMatchObject({
      targetPath: resolveHomePath("~/.qwenworkcn/skills"),
      primaryAgentId: "qwenworkcn"
    })
  })

  it("selects the first existing Trae priority target", async () => {
    const service = createService({
      definitions: [definition("trae")],
      existingPaths: [
        resolveHomePath("~/.trae-cn"),
        resolveHomePath("~/.trae-cn/skills"),
        resolveHomePath("~/.trae/skills")
      ]
    })

    const snapshot = await service.refresh()

    expect(snapshot.installedAgentIds).toEqual(["trae"])
    expect(snapshot.agentStatuses[0].targetPaths).toEqual([resolveHomePath("~/.trae-cn/skills")])
    expect(snapshot.uniqueTargets).toHaveLength(1)
    expect(snapshot.uniqueTargets[0].targetPath).toBe(resolveHomePath("~/.trae-cn/skills"))
  })

  it("falls back to the Trae international target when the CN target is missing", async () => {
    const service = createService({
      definitions: [definition("trae")],
      existingPaths: [resolveHomePath("~/.trae"), resolveHomePath("~/.trae/skills")]
    })

    const snapshot = await service.refresh()

    expect(snapshot.installedAgentIds).toEqual(["trae"])
    expect(snapshot.agentStatuses[0].targetPaths).toEqual([resolveHomePath("~/.trae/skills")])
    expect(snapshot.uniqueTargets).toHaveLength(1)
    expect(snapshot.uniqueTargets[0].targetPath).toBe(resolveHomePath("~/.trae/skills"))
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
