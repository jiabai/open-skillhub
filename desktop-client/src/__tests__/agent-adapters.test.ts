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
})
