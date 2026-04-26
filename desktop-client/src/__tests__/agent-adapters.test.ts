import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createCodexAgentAdapter } from "@/adapters/agents/codex"
import { createClaudeCodeAgentAdapter } from "@/adapters/agents/claude-code"
import { createGeminiCliAgentAdapter } from "@/adapters/agents/gemini-cli"
import { getAgentAdapter, hasAgentAdapter, listAgentAdapters } from "@/adapters/agents/registry"
import type { ExtractedSkillPayloadV1 } from "@/adapters/agents/base"

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
    const root = mkdtempSync(join(tmpdir(), "open-skillhub-agent-"))
    tempRoots.push(root)
    return root
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

  async function assertAdapterInstall(adapterId: "codex" | "claude-code" | "gemini-cli") {
    const skillsPath = createTempRoot()
    const { extractedPath, expectedFiles } = createExtractedSkillDirectory()
    const payload: ExtractedSkillPayloadV1 = {
      skillId: "sample-skill",
      version: "1.0.0",
      extractedPath
    }
    const adapter = getAgentAdapter(adapterId)
    const installed = await adapter.installSkill(payload, { skillsPath })

    expect(installed.skillDir).toBe(join(skillsPath, payload.skillId))
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
    expect(listAgentAdapters().map((adapter) => adapter.id)).toEqual([
      "codex",
      "claude-code",
      "gemini-cli"
    ])
    expect(hasAgentAdapter("codex")).toBe(true)
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

  it("reads installed metadata from SKILL.md frontmatter first", async () => {
    const skillsPath = createTempRoot()
    const skillDir = join(skillsPath, "sample-skill")
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, "SKILL.md"), "---\nversion: 2.0.0\n---\n# Sample")
    writeFileSync(join(skillDir, "manifest.json"), JSON.stringify({ version: "1.0.0" }))

    await expect(
      getAgentAdapter("codex").readInstalledSkillMetadata("sample-skill", { skillsPath })
    ).resolves.toEqual({
      exists: true,
      skillDir,
      version: "2.0.0",
      versionSource: "skill-frontmatter"
    })
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
      versionSource: null
    })
    expect(() => statSync(skillDir)).toThrow()
  })

  it("rejects unsafe skill identifiers for metadata reads", async () => {
    await expect(
      getAgentAdapter("codex").readInstalledSkillMetadata("../unsafe", { skillsPath: createTempRoot() })
    ).rejects.toThrow("Invalid skill identifier")
  })
})
