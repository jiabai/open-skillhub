import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  SkillPackageTreeError,
  assertRootSkillFile,
  collectSkillPackageTreeFiles,
  copySkillPackageTree
} from "@/core/skills/skill-package-tree"

describe("skill package tree", () => {
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
    const root = mkdtempSync(join(tmpdir(), "skilldrive-tree-"))
    tempRoots.push(root)
    return root
  }

  function createSkill(root: string): void {
    mkdirSync(join(root, "docs"), { recursive: true })
    writeFileSync(join(root, "SKILL.md"), "---\nname: tree\n---\n# Tree", "utf8")
    writeFileSync(join(root, "docs", "guide.md"), "Guide", "utf8")
    mkdirSync(join(root, ".git"), { recursive: true })
    writeFileSync(join(root, ".git", "ignored.txt"), "ignored", "utf8")
  }

  it("requires a root SKILL.md file", async () => {
    const root = createTempRoot()

    await expect(assertRootSkillFile(root)).rejects.toThrow("Root SKILL.md is required")

    writeFileSync(join(root, "SKILL.md"), "# Skill")

    await expect(assertRootSkillFile(root)).resolves.toBeUndefined()
  })

  it("collects safe files in stable order with optional bytes and ignored directories", async () => {
    const root = createTempRoot()
    createSkill(root)

    const entries = await collectSkillPackageTreeFiles({
      rootPath: root,
      maxFileCount: 10,
      maxTotalBytes: 1024,
      includeBytes: true,
      ignoredDirectoryNames: [".git"]
    })

    expect(entries.map((entry) => entry.relativePath)).toEqual(["SKILL.md", "docs/guide.md"])
    expect(entries[0].bytes?.toString("utf8")).toContain("name: tree")
  })

  it("rejects symlink entries", async () => {
    const root = createTempRoot()
    createSkill(root)

    try {
      symlinkSync(join(root, "SKILL.md"), join(root, "linked.md"))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        return
      }

      throw error
    }

    await expect(
      collectSkillPackageTreeFiles({
        rootPath: root,
        maxFileCount: 10,
        maxTotalBytes: 1024
      })
    ).rejects.toMatchObject(new SkillPackageTreeError("symlink", "Skill package cannot include symbolic links"))
  })

  it("rejects configured file count and size limits", async () => {
    const root = createTempRoot()
    createSkill(root)

    await expect(
      collectSkillPackageTreeFiles({
        rootPath: root,
        maxFileCount: 1,
        maxTotalBytes: 1024,
        ignoredDirectoryNames: [".git"]
      })
    ).rejects.toMatchObject(new SkillPackageTreeError("too-many-files", "Skill package exceeds the file count limit"))

    await expect(
      collectSkillPackageTreeFiles({
        rootPath: root,
        maxFileCount: 10,
        maxTotalBytes: 5,
        ignoredDirectoryNames: [".git"]
      })
    ).rejects.toMatchObject(new SkillPackageTreeError("too-large", "Skill package exceeds the size limit"))
  })

  it("copies safe trees and verifies the copied root", async () => {
    const root = createTempRoot()
    const source = join(root, "source")
    const destination = join(root, "destination")
    createSkill(source)

    await copySkillPackageTree({
      sourceRoot: source,
      destinationRoot: destination,
      maxFileCount: 10,
      maxTotalBytes: 1024,
      ignoredDirectoryNames: [".git"]
    })

    expect(readFileSync(join(destination, "docs", "guide.md"), "utf8")).toBe("Guide")
    expect(existsSync(join(destination, ".git", "ignored.txt"))).toBe(false)
    await expect(assertRootSkillFile(destination)).resolves.toBeUndefined()
  })
})
