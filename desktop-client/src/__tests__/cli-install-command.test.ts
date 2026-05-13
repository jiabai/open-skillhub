import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { getAgentAdapter, hasAgentAdapter } from "@/adapters/agents/registry"
import type { AgentPathDefinition } from "@/adapters/agents/definitions"
import { runInstallCommand } from "@/cli/commands/install"
import { CliError } from "@/cli/services/cli-errors"

describe("CLI install command", () => {
  const tempRoots: string[] = []
  const definitions: AgentPathDefinition[] = [
    {
      id: "codex",
      displayName: "Codex",
      detectionDirs: ["~/.codex"],
      defaultTargets: [{ path: "~/.agents/skills", role: "primary" }],
      projectTargets: [{ path: ".agents/skills", role: "primary" }],
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

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createTempRoot(): string {
    const root = join(tmpdir(), `skilldrive-cli-install-${Math.random().toString(16).slice(2)}`)
    mkdirSync(root, { recursive: true })
    tempRoots.push(root)
    return root
  }

  function createSkillPackage(root: string, name = "install-skill"): string {
    const packageRoot = join(root, name)
    mkdirSync(packageRoot, { recursive: true })
    writeFileSync(join(packageRoot, "SKILL.md"), `---\nname: ${name}\nversion: 1.0.0\n---\n# Skill`)
    writeFileSync(join(packageRoot, "README.md"), "local install")
    return packageRoot
  }

  it("creates a dry-run plan without writing files", async () => {
    const root = createTempRoot()
    const sourcePath = createSkillPackage(root)
    const result = await runInstallCommand({
      sourcePath,
      scope: { type: "global" },
      yes: false,
      json: true,
      cacheDir: join(root, "cache"),
      targetOptions: {
        definitions,
        homeDir: () => root,
        platform: "linux",
        pathExists: async () => true
      },
      resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
    })

    expect(result.exitCode).toBe(0)
    expect(result.plan.dryRun).toBe(true)
    expect(result.plan.targets.map((target) => target.destinationPath)).toContain(
      join(root, ".agents", "skills", "install-skill")
    )
    expect(existsSync(join(root, ".agents", "skills", "install-skill"))).toBe(false)
  })

  it("writes selected global targets when --yes is present", async () => {
    const root = createTempRoot()
    const sourcePath = createSkillPackage(root, "hermes-skill")
    const result = await runInstallCommand({
      sourcePath,
      scope: { type: "global" },
      agentFilter: ["hermes"],
      yes: true,
      json: true,
      cacheDir: join(root, "cache"),
      targetOptions: {
        definitions,
        homeDir: () => root,
        platform: "linux",
        pathExists: async () => true
      },
      resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
    })

    expect(result.exitCode).toBe(0)
    expect(readFileSync(join(root, ".hermes", "skills", "general", "hermes-skill", "README.md"), "utf8")).toBe(
      "local install"
    )
    expect(existsSync(join(root, ".agents", "skills", "hermes-skill"))).toBe(false)
  })

  it("requires overwrite for existing local install destinations", async () => {
    const root = createTempRoot()
    const sourcePath = createSkillPackage(root, "existing-skill")
    const existingDestination = join(root, ".agents", "skills", "existing-skill")
    mkdirSync(existingDestination, { recursive: true })
    writeFileSync(join(existingDestination, "README.md"), "old")

    await expect(
      runInstallCommand({
        sourcePath,
        scope: { type: "global" },
        agentFilter: ["codex"],
        yes: true,
        json: true,
        cacheDir: join(root, "cache"),
        targetOptions: {
          definitions,
          homeDir: () => root,
          platform: "linux",
          pathExists: async () => true
        },
        resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
      })
    ).rejects.toMatchObject(new CliError("validation", "Install plan has blocking conflicts"))

    const result = await runInstallCommand({
      sourcePath,
      scope: { type: "global" },
      agentFilter: ["codex"],
      yes: true,
      overwrite: true,
      json: true,
      cacheDir: join(root, "cache"),
      targetOptions: {
        definitions,
        homeDir: () => root,
        platform: "linux",
        pathExists: async () => true
      },
      resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
    })

    expect(result.exitCode).toBe(0)
    expect(readFileSync(join(existingDestination, "README.md"), "utf8")).toBe("local install")
  })

  it("installs into explicit project targets", async () => {
    const root = createTempRoot()
    const projectPath = join(root, "project")
    const sourcePath = createSkillPackage(root, "project-skill")
    const result = await runInstallCommand({
      sourcePath,
      scope: { type: "project", projectPath },
      yes: true,
      json: true,
      cacheDir: join(root, "cache"),
      targetOptions: {
        definitions,
        platform: "win32"
      },
      resolveAgentAdapter: (agentId) => (hasAgentAdapter(agentId) ? getAgentAdapter(agentId) : null)
    })

    expect(result.exitCode).toBe(0)
    expect(readFileSync(join(projectPath, ".agents", "skills", "project-skill", "README.md"), "utf8")).toBe(
      "local install"
    )
  })
})
