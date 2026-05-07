import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  mkdirSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import type { AgentPathDefinition } from "@/adapters/agents/definitions"
import { createProjectSkillImportService } from "@/core/projects/project-skill-import-service"
import type { ProjectEntry } from "@/types"

const definitions: AgentPathDefinition[] = [
  {
    id: "claude-code",
    displayName: "Claude Code",
    detectionDirs: [],
    defaultTargets: [],
    pathResolution: "all-owned",
    projectTargets: [{ path: ".claude/skills", role: "primary" }]
  },
  {
    id: "cursor",
    displayName: "Cursor",
    detectionDirs: [],
    defaultTargets: [],
    pathResolution: "all-owned",
    projectTargets: [{ path: ".claude/skills", role: "compatible-read" }]
  }
]

function createSkill(root: string, name = "demo-skill"): void {
  mkdirSync(root, { recursive: true })
  writeFileSync(
    join(root, "SKILL.md"),
    `---\nname: Demo Skill\nslug: ${name}\nversion: 1.2.3\ndescription: Demo import\n---\n`,
    "utf8"
  )
  mkdirSync(join(root, "scripts"))
  writeFileSync(join(root, "scripts", "run.txt"), "ok", "utf8")
}

describe("project skill import service", () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createProject(): ProjectEntry {
    const root = mkdtempSync(join(tmpdir(), "skilldrive-project-import-"))
    tempRoots.push(root)

    return {
      id: "project-1",
      name: "Example",
      path: root,
      addedAt: "2026-05-07T00:00:00.000Z",
      updatedAt: "2026-05-07T00:00:00.000Z"
    }
  }

  it("validates and copies a skill folder into a writable project target", async () => {
    const project = createProject()
    const sourceRoot = mkdtempSync(join(tmpdir(), "skilldrive-source-"))
    tempRoots.push(sourceRoot)
    createSkill(sourceRoot, "demo-skill")
    const service = createProjectSkillImportService({ definitions })

    await expect(service.validateSkillFolder({ sourcePath: sourceRoot })).resolves.toEqual(
      expect.objectContaining({
        valid: true,
        identity: "demo-skill",
        version: "1.2.3",
        description: "Demo import"
      })
    )

    const result = await service.importSkill({
      project,
      sourcePath: sourceRoot,
      targetAgentId: "claude-code",
      overwrite: false
    })
    const destination = join(project.path, ".claude", "skills", "demo-skill")

    expect(result).toEqual(
      expect.objectContaining({
        projectId: "project-1",
        identity: "demo-skill",
        targetPath: destination,
        overwritten: false
      })
    )
    expect(readFileSync(join(destination, "scripts", "run.txt"), "utf8")).toBe("ok")
  })

  it("rejects conflicts unless overwrite is explicit", async () => {
    const project = createProject()
    const sourceRoot = mkdtempSync(join(tmpdir(), "skilldrive-source-"))
    tempRoots.push(sourceRoot)
    createSkill(sourceRoot, "demo-skill")
    const destination = join(project.path, ".claude", "skills", "demo-skill")
    createSkill(destination, "demo-skill")
    writeFileSync(join(destination, "stale.txt"), "stale", "utf8")
    const service = createProjectSkillImportService({ definitions })

    await expect(
      service.importSkill({
        project,
        sourcePath: sourceRoot,
        targetAgentId: "claude-code",
        overwrite: false
      })
    ).rejects.toThrow(/already exists/i)

    const overwritten = await service.importSkill({
      project,
      sourcePath: sourceRoot,
      targetAgentId: "claude-code",
      overwrite: true
    })

    expect(overwritten.overwritten).toBe(true)
    expect(existsSync(join(destination, "stale.txt"))).toBe(false)
    expect(readFileSync(join(destination, "scripts", "run.txt"), "utf8")).toBe("ok")
  })

  it("rejects non-writable compatible read targets", async () => {
    const project = createProject()
    const sourceRoot = mkdtempSync(join(tmpdir(), "skilldrive-source-"))
    tempRoots.push(sourceRoot)
    createSkill(sourceRoot, "demo-skill")
    const service = createProjectSkillImportService({ definitions })

    await expect(
      service.importSkill({
        project,
        sourcePath: sourceRoot,
        targetAgentId: "cursor",
        overwrite: false
      })
    ).rejects.toThrow(/No writable project target/i)
  })

  it("rejects missing SKILL.md and excessive file count", async () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), "skilldrive-source-"))
    tempRoots.push(sourceRoot)
    const service = createProjectSkillImportService({
      definitions,
      maxFileCount: 1
    })

    await expect(service.validateSkillFolder({ sourcePath: sourceRoot })).resolves.toEqual(
      expect.objectContaining({
        valid: false,
        validationState: "missing-skill-md"
      })
    )

    createSkill(sourceRoot, "demo-skill")
    writeFileSync(join(sourceRoot, "extra.txt"), "extra", "utf8")

    await expect(service.validateSkillFolder({ sourcePath: sourceRoot })).resolves.toEqual(
      expect.objectContaining({
        valid: false,
        validationState: "unreadable",
        validationMessage: expect.stringMatching(/too many files/i)
      })
    )
  })

  it("rejects symlink entries before importing", async () => {
    const project = createProject()
    const sourceRoot = mkdtempSync(join(tmpdir(), "skilldrive-source-"))
    tempRoots.push(sourceRoot)
    createSkill(sourceRoot, "demo-skill")

    try {
      symlinkSync(join(sourceRoot, "SKILL.md"), join(sourceRoot, "linked-skill.md"))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        return
      }

      throw error
    }

    expect(lstatSync(join(sourceRoot, "linked-skill.md")).isSymbolicLink()).toBe(true)
    const service = createProjectSkillImportService({ definitions })

    await expect(
      service.importSkill({
        project,
        sourcePath: sourceRoot,
        targetAgentId: "claude-code",
        overwrite: false
      })
    ).rejects.toThrow(/symlink/i)
  })
})
