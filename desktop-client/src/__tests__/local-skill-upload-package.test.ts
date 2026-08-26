import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { computeSkillContentHash } from "@/adapters/agents/base"
import { prepareLocalSkillUploadPackage } from "@/core/local-skills/local-skill-upload-package"

const tempRoots: string[] = []

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "skilldrive-local-upload-test-"))
  tempRoots.push(root)
  return root
}

function readZipFileNames(zipPath: string): string[] {
  const bytes = readFileSync(zipPath)
  const names: string[] = []
  let offset = 0

  while (offset < bytes.length - 4) {
    if (bytes.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1
      continue
    }

    const compressedSize = bytes.readUInt32LE(offset + 18)
    const fileNameLength = bytes.readUInt16LE(offset + 26)
    const extraLength = bytes.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const nameEnd = nameStart + fileNameLength

    names.push(bytes.subarray(nameStart, nameEnd).toString("utf8"))
    offset = nameEnd + extraLength + compressedSize
  }

  return names
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe("prepareLocalSkillUploadPackage", () => {
  it("creates a temporary zip with SKILL.md at the archive root and cleans it up", async () => {
    const skillRoot = createTempRoot()
    const cacheRoot = createTempRoot()
    mkdirSync(join(skillRoot, "docs"))
    writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: local-only\nversion: 1.0.0\n---\n# Local")
    writeFileSync(join(skillRoot, "docs", "guide.md"), "Guide")

    const prepared = await prepareLocalSkillUploadPackage({
      packageRootPath: skillRoot,
      skillName: "local-only",
      cacheDirectory: cacheRoot
    })

    expect(existsSync(prepared.artifactPath)).toBe(true)
    expect(basename(prepared.artifactPath)).toBe("local-only.zip")
    expect(readZipFileNames(prepared.artifactPath)).toEqual(["SKILL.md", "docs/guide.md"])

    await prepared.cleanup()

    expect(existsSync(prepared.artifactPath)).toBe(false)
  })

  it("keeps ignored runtime directories out of the content hash just like upload packaging", async () => {
    const skillRoot = createTempRoot()
    const cacheRoot = createTempRoot()
    writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: local-only\n---\n# Local")
    mkdirSync(join(skillRoot, "docs"))
    writeFileSync(join(skillRoot, "docs", "guide.md"), "Guide")

    const baselineHash = await computeSkillContentHash(skillRoot)

    for (const directory of ["__pycache__", ".git", "node_modules"]) {
      mkdirSync(join(skillRoot, directory), { recursive: true })
      writeFileSync(join(skillRoot, directory, "generated.bin"), directory)
    }

    const hashWithIgnoredDirectories = await computeSkillContentHash(skillRoot)
    expect(hashWithIgnoredDirectories).toBe(baselineHash)

    const prepared = await prepareLocalSkillUploadPackage({
      packageRootPath: skillRoot,
      skillName: "local-only",
      cacheDirectory: cacheRoot
    })

    expect(readZipFileNames(prepared.artifactPath)).toEqual(["SKILL.md", "docs/guide.md"])
    await prepared.cleanup()
  })

  it("rejects a package root without SKILL.md", async () => {
    const skillRoot = createTempRoot()
    const cacheRoot = createTempRoot()
    writeFileSync(join(skillRoot, "README.md"), "Not a skill")

    await expect(
      prepareLocalSkillUploadPackage({
        packageRootPath: skillRoot,
        skillName: "missing-skill-md",
        cacheDirectory: cacheRoot
      })
    ).rejects.toThrow("Root SKILL.md is required before uploading a local skill")
  })

  it("rejects packages that exceed configured file count or size limits", async () => {
    const skillRoot = createTempRoot()
    const cacheRoot = createTempRoot()
    writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: too-large\n---\n# Too Large")
    writeFileSync(join(skillRoot, "payload.txt"), "1234567890")

    await expect(
      prepareLocalSkillUploadPackage({
        packageRootPath: skillRoot,
        skillName: "too-large",
        cacheDirectory: cacheRoot,
        maxTotalBytes: 5
      })
    ).rejects.toThrow("Local skill package exceeds the upload size limit")

    await expect(
      prepareLocalSkillUploadPackage({
        packageRootPath: skillRoot,
        skillName: "too-large",
        cacheDirectory: cacheRoot,
        maxFileCount: 1
      })
    ).rejects.toThrow("Local skill package exceeds the file count limit")
  })
})
