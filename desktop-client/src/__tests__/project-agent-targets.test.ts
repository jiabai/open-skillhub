import { join, normalize } from "node:path"
import { describe, expect, it } from "vitest"

import { supportedAgentDefinitions, type AgentPathDefinition } from "@/adapters/agents/definitions"
import { resolveProjectAgentTargets } from "@/core/projects/project-agent-targets"
import type { ProjectEntry } from "@/types"

const project: ProjectEntry = {
  id: "project-1",
  name: "Example",
  path: normalize("C:/Projects/Example"),
  addedAt: "2026-05-07T00:00:00.000Z",
  updatedAt: "2026-05-07T00:00:00.000Z"
}

function definition(id: AgentPathDefinition["id"]): AgentPathDefinition {
  const found = supportedAgentDefinitions.find((item) => item.id === id)

  if (!found) {
    throw new Error(`Missing definition: ${id}`)
  }

  return found
}

describe("project agent targets", () => {
  it("resolves catalog project paths under the selected project root", () => {
    const targets = resolveProjectAgentTargets(project, {
      definitions: [definition("claude-code")],
      platform: "win32"
    })

    expect(targets).toEqual([
      expect.objectContaining({
        primaryAgentId: "claude-code",
        coveredAgentIds: ["claude-code"],
        displayNames: ["Claude Code"],
        relativePath: ".claude\\skills",
        targetPath: join(project.path, ".claude", "skills"),
        writable: true
      })
    ])
  })

  it("deduplicates shared project skill paths while preserving covered agents", () => {
    const targets = resolveProjectAgentTargets(project, {
      definitions: [definition("cline"), definition("codex"), definition("warp")],
      platform: "win32"
    })

    expect(targets).toHaveLength(1)
    expect(targets[0]).toEqual(
      expect.objectContaining({
        primaryAgentId: "cline",
        coveredAgentIds: ["cline", "codex", "warp"],
        displayNames: ["Cline", "Codex", "Warp"],
        sharedPathKey: "agents-universal",
        relativePath: ".agents\\skills",
        writable: true
      })
    )
  })

  it("keeps compatible read paths out of writable import target selection", () => {
    const targets = resolveProjectAgentTargets(project, {
      definitions: [definition("cursor")],
      platform: "win32"
    })

    expect(targets).toEqual([
      expect.objectContaining({
        primaryAgentId: "cursor",
        relativePath: ".cursor\\skills",
        writable: true
      }),
      expect.objectContaining({
        primaryAgentId: "cursor",
        relativePath: ".claude\\skills",
        writable: false
      }),
      expect.objectContaining({
        primaryAgentId: "cursor",
        relativePath: ".codex\\skills",
        writable: false
      })
    ])
  })

  it("carries categorized project target layout metadata", () => {
    const definitions: AgentPathDefinition[] = [
      {
        ...definition("claude-code"),
        projectTargets: [
          {
            path: ".hermes/skills",
            role: "primary",
            skillLayout: {
              mode: "categorized",
              categoryDepth: 1,
              defaultCategory: "general",
              categorySource: "agent-default"
            }
          }
        ]
      }
    ]

    const targets = resolveProjectAgentTargets(project, {
      definitions,
      platform: "win32"
    })

    expect(targets[0]).toMatchObject({
      targetPath: join(project.path, ".hermes", "skills"),
      skillLayout: {
        mode: "categorized",
        categoryDepth: 1,
        defaultCategory: "general",
        categorySource: "agent-default"
      }
    })
  })

  it("rejects catalog project targets that escape the project root", () => {
    const definitions: AgentPathDefinition[] = [
      {
        ...definition("claude-code"),
        projectTargets: [{ path: "../escape", role: "primary" }]
      }
    ]

    expect(() =>
      resolveProjectAgentTargets(project, {
        definitions,
        platform: "win32"
      })
    ).toThrow(/must stay inside the project root/i)
  })
})
