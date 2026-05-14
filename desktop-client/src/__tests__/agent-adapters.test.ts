import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createCodexAgentAdapter } from "@/adapters/agents/codex"
import { createClaudeCodeAgentAdapter } from "@/adapters/agents/claude-code"
import { createGeminiCliAgentAdapter } from "@/adapters/agents/gemini-cli"
import { supportedAgentDefinitions } from "@/adapters/agents/definitions"
import { getAgentAdapter, hasAgentAdapter, listAgentAdapters } from "@/adapters/agents/registry"
import type { AgentId } from "@/types"

describe("agent adapters", () => {
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
    const root = mkdtempSync(join(tmpdir(), "skilldrive-cli-"))
    tempRoots.push(root)
    return root
  }

  function computeExpectedContentHash(entries: Array<[string, string]>): string {
    const hasher = createHash("sha256")

    for (const [relativePath, content] of entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
      hasher.update(`${relativePath}\0`)
      hasher.update(content)
      hasher.update("\0")
    }

    return hasher.digest("hex")
  }

  function createExtractedSkillDirectory(): { extractedPath: string; expectedFiles: string[] } {
    const extractedRoot = createTempRoot()
    const extractedPath = join(extractedRoot, "extracted-skill")
    const nestedDir = join(extractedPath, "skills")
    const docsDir = join(extractedPath, "docs")

    mkdirSync(nestedDir, { recursive: true })
    mkdirSync(docsDir, { recursive: true })
    writeFileSync(join(extractedPath, "README.md"), "# Sample Skill")
    writeFileSync(join(nestedDir, "manifest.json"), JSON.stringify({ version: "1.0.0" }))
    writeFileSync(join(docsDir, "notes.txt"), "copied")

    return {
      extractedPath,
      expectedFiles: ["README.md", "skills/manifest.json", "docs/notes.txt"]
    }
  }

  async function assertAdapterInstall(adapterId: AgentId) {
    const skillsPath = createTempRoot()
    const { extractedPath, expectedFiles } = createExtractedSkillDirectory()
    const payload = {
      skillId: "f4919f10-e7fc-40df-ae6f-fe7bfe050ac5",
      name: "Sample Skill",
      version: "1.0.0",
      extractedPath
    }
    const adapter = getAgentAdapter(adapterId)
    const installed = await adapter.installSkill(payload, { skillsPath })

    expect(installed.skillDir).toBe(join(skillsPath, payload.name))
    expect(statSync(installed.skillDir).isDirectory()).toBe(true)
    expect(installed.filePaths.sort()).toEqual(expectedFiles.sort())
    expect(readFileSync(join(installed.skillDir, "README.md"), "utf8")).toBe("# Sample Skill")
    expect(readFileSync(join(installed.skillDir, "skills", "manifest.json"), "utf8")).toBe(
      JSON.stringify({ version: "1.0.0" })
    )
    expect(readFileSync(join(installed.skillDir, "docs", "notes.txt"), "utf8")).toBe("copied")
    expect(await adapter.verifyInstalledSkill(payload, installed)).toBe(true)
  }

  it("registers all supported adapters", () => {
    const expectedAgentIds = [
      "claude-code",
      "cursor",
      "windsurf",
      "copilot",
      "roocode",
      "cline",
      "gemini-cli",
      "codex",
      "opencode",
      "kilocode",
      "amp",
      "kiro",
      "warp",
      "trae",
      "factory",
      "kimi",
      "mistral",
      "pi",
      "antigravity",
      "openclaw",
      "codebuddy",
      "workbuddy",
      "hermes"
    ]

    expect(supportedAgentDefinitions.map((definition) => definition.id)).toEqual(expectedAgentIds)
    expect(listAgentAdapters().map((adapter) => adapter.id)).toEqual(expectedAgentIds)
    expect(hasAgentAdapter("codex")).toBe(true)
    expect(hasAgentAdapter("zed")).toBe(false)
    expect(hasAgentAdapter("augmentcode")).toBe(false)
    expect(hasAgentAdapter("jetbrains-ai")).toBe(false)
    expect(hasAgentAdapter("unknown")).toBe(false)
  })

  it("installs Codex skills to a filesystem directory and verifies them", async () => {
    await assertAdapterInstall("codex")
  })

  it("installs Claude Code skills to a filesystem directory and verifies them", async () => {
    await assertAdapterInstall("claude-code")
  })

  it("installs Gemini CLI skills to a filesystem directory and verifies them", async () => {
    await assertAdapterInstall("gemini-cli")
  })

  it("exposes standalone adapter factories", () => {
    expect(createCodexAgentAdapter().id).toBe("codex")
    expect(createClaudeCodeAgentAdapter().id).toBe("claude-code")
    expect(createGeminiCliAgentAdapter().id).toBe("gemini-cli")
  })

  it("reads installed metadata by skill name from SKILL.md frontmatter first", async () => {
    const skillsPath = createTempRoot()
    const skillDir = join(skillsPath, "Sample Skill")
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, "SKILL.md"), "---\nversion: 2.0.0\n---\n# Sample")
    writeFileSync(join(skillDir, "manifest.json"), JSON.stringify({ version: "1.0.0" }))
    writeFileSync(join(skillDir, ".env.example"), "dotfile participates")
    writeFileSync(join(skillDir, ".DS_Store"), "ignored")

    await expect(
      getAgentAdapter("codex").readInstalledSkillMetadata("Sample Skill", { skillsPath })
    ).resolves.toEqual({
      exists: true,
      skillDir,
      version: "2.0.0",
      versionSource: "skill-frontmatter",
      contentHash: computeExpectedContentHash([
        ([".env.example", "dotfile participates"]),
        (["SKILL.md", "---\nversion: 2.0.0\n---\n# Sample"]),
        (["manifest.json", JSON.stringify({ version: "1.0.0" })])
      ])
    })
  })

  it("installs and reads categorized skills through target layout metadata", async () => {
    const skillsPath = createTempRoot()
    const { extractedPath } = createExtractedSkillDirectory()
    const payload = {
      skillId: "f4919f10-e7fc-40df-ae6f-fe7bfe050ac5",
      name: "Categorized Skill",
      version: "1.0.0",
      extractedPath
    }
    const skillLayout = {
      mode: "categorized" as const,
      categoryDepth: 1 as const,
      defaultCategory: "general",
      categorySource: "agent-default" as const
    }

    const installed = await getAgentAdapter("hermes").installSkill(payload, {
      skillsPath,
      skillLayout
    })
    const expectedSkillDir = join(skillsPath, "general", "Categorized Skill")

    expect(installed.skillDir).toBe(expectedSkillDir)
    expect(readFileSync(join(expectedSkillDir, "README.md"), "utf8")).toBe("# Sample Skill")
    await expect(
      getAgentAdapter("hermes").readInstalledSkillMetadata("Categorized Skill", {
        skillsPath,
        skillLayout
      })
    ).resolves.toMatchObject({
      exists: true,
      skillDir: expectedSkillDir,
      version: "1.0.0",
      versionSource: "nested-manifest-json"
    })
  })

  it("reports categorized missing skills under the deterministic default category", async () => {
    const skillsPath = createTempRoot()
    const skillLayout = {
      mode: "categorized" as const,
      categoryDepth: 1 as const,
      defaultCategory: "general",
      categorySource: "agent-default" as const
    }

    await expect(
      getAgentAdapter("hermes").readInstalledSkillMetadata("Missing Skill", {
        skillsPath,
        skillLayout
      })
    ).resolves.toEqual({
      exists: false,
      skillDir: join(skillsPath, "general", "Missing Skill"),
      version: null,
      versionSource: null,
      contentHash: null
    })
  })

  it("fails closed when categorized metadata reads find duplicate skill names", async () => {
    const skillsPath = createTempRoot()
    const skillLayout = {
      mode: "categorized" as const,
      categoryDepth: 1 as const,
      defaultCategory: "general",
      categorySource: "agent-default" as const
    }

    for (const category of ["general", "tools"]) {
      const skillDir = join(skillsPath, category, "Duplicate Skill")
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, "SKILL.md"), "---\nversion: 1.0.0\n---\n# Duplicate")
    }

    await expect(
      getAgentAdapter("hermes").readInstalledSkillMetadata("Duplicate Skill", {
        skillsPath,
        skillLayout
      })
    ).rejects.toThrow(/multiple categorized skill directories/i)
  })

  it("falls back to root and nested manifest metadata", async () => {
    const skillsPath = createTempRoot()
    const rootManifestDir = join(skillsPath, "root-manifest")
    const nestedManifestDir = join(skillsPath, "nested-manifest")

    mkdirSync(rootManifestDir, { recursive: true })
    writeFileSync(join(rootManifestDir, "manifest.json"), JSON.stringify({ version: "1.2.0" }))

    mkdirSync(join(nestedManifestDir, "skills"), { recursive: true })
    writeFileSync(join(nestedManifestDir, "manifest.json"), "{")
    writeFileSync(
      join(nestedManifestDir, "skills", "manifest.json"),
      JSON.stringify({ version: "1.3.0" })
    )

    await expect(
      getAgentAdapter("codex").readInstalledSkillMetadata("root-manifest", { skillsPath })
    ).resolves.toMatchObject({
      version: "1.2.0",
      versionSource: "manifest-json"
    })
    await expect(
      getAgentAdapter("codex").readInstalledSkillMetadata("nested-manifest", { skillsPath })
    ).resolves.toMatchObject({
      version: "1.3.0",
      versionSource: "nested-manifest-json"
    })
  })

  it("reports missing installed skill directories without creating them", async () => {
    const skillsPath = createTempRoot()
    const skillDir = join(skillsPath, "missing-skill")

    await expect(
      getAgentAdapter("codex").readInstalledSkillMetadata("missing-skill", { skillsPath })
    ).resolves.toEqual({
      exists: false,
      skillDir,
      version: null,
      versionSource: null,
      contentHash: null
    })
    expect(() => statSync(skillDir)).toThrow()
  })

  it("rejects unsafe skill directory names for metadata reads", async () => {
    await expect(
      getAgentAdapter("codex").readInstalledSkillMetadata("../unsafe", { skillsPath: createTempRoot() })
    ).rejects.toThrow("Invalid skill directory name")
  })
})
