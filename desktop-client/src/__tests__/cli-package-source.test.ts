import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { prepareCliLocalPackageSource } from "@/cli/services/cli-package-source"
import { prepareLocalSkillUploadPackage } from "@/core/local-skills/local-skill-upload-package"

describe("CLI local package source preparation", () => {
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
    const root = join(tmpdir(), `skilldrive-cli-package-${Math.random().toString(16).slice(2)}`)
    mkdirSync(root, { recursive: true })
    tempRoots.push(root)
    return root
  }

  function createSkillPackage(root: string, name = "local-skill"): string {
    const packageRoot = join(root, name)
    mkdirSync(packageRoot, { recursive: true })
    writeFileSync(
      join(packageRoot, "SKILL.md"),
      `---\nname: ${name}\nversion: 1.2.3\n---\n# ${name}`
    )
    writeFileSync(join(packageRoot, "README.md"), "# Readme")
    return packageRoot
  }

  it("accepts a local directory with root SKILL.md and does not clean up the source", async () => {
    const root = createTempRoot()
    const sourcePath = createSkillPackage(root)
    const prepared = await prepareCliLocalPackageSource({
      sourcePath,
      cacheDir: join(root, "cache")
    })

    expect(prepared.skillId).toBe("local:local-skill")
    expect(prepared.name).toBe("local-skill")
    expect(prepared.version).toBe("1.2.3")
    expect(prepared.extractedPath).toBe(sourcePath)

    await prepared.cleanup()

    expect(existsSync(sourcePath)).toBe(true)
  })

  it("rejects missing SKILL.md and configured package limits", async () => {
    const root = createTempRoot()
    const missingSkillMd = join(root, "missing")
    mkdirSync(missingSkillMd, { recursive: true })
    writeFileSync(join(missingSkillMd, "README.md"), "# nope")

    await expect(
      prepareCliLocalPackageSource({ sourcePath: missingSkillMd, cacheDir: join(root, "cache") })
    ).rejects.toThrow("Root SKILL.md is required")

    const tooManyFiles = createSkillPackage(root, "too-many")
    writeFileSync(join(tooManyFiles, "extra.txt"), "x")

    await expect(
      prepareCliLocalPackageSource({
        sourcePath: tooManyFiles,
        cacheDir: join(root, "cache"),
        maxFileCount: 1
      })
    ).rejects.toThrow("Local skill package exceeds the file count limit")

    const tooLarge = createSkillPackage(root, "too-large")
    writeFileSync(join(tooLarge, "large.txt"), "123456")

    await expect(
      prepareCliLocalPackageSource({
        sourcePath: tooLarge,
        cacheDir: join(root, "cache"),
        maxTotalBytes: 10
      })
    ).rejects.toThrow("Local skill package exceeds the size limit")
  })

  it("extracts a zip package into cache and cleans it up", async () => {
    const root = createTempRoot()
    const packageRoot = createSkillPackage(root, "zip-skill")
    const cacheDir = join(root, "cache")
    const upload = await prepareLocalSkillUploadPackage({
      packageRootPath: packageRoot,
      skillName: "zip-skill",
      cacheDirectory: cacheDir
    })
    const prepared = await prepareCliLocalPackageSource({
      sourcePath: upload.artifactPath,
      cacheDir
    })
    const extractedPath = prepared.extractedPath

    expect(readFileSync(join(extractedPath, "SKILL.md"), "utf8")).toContain("zip-skill")
    expect(statSync(extractedPath).isDirectory()).toBe(true)

    await prepared.cleanup()
    await upload.cleanup()

    expect(existsSync(extractedPath)).toBe(false)
  })

  it("rejects zip entries that try to escape the extraction root", async () => {
    const root = createTempRoot()
    const archivePath = join(root, "slip.zip")
    writeFileSync(archivePath, createSingleFileZip("../escape.txt", "bad"))

    await expect(
      prepareCliLocalPackageSource({
        sourcePath: archivePath,
        cacheDir: join(root, "cache")
      })
    ).rejects.toThrow("Unsafe zip entry path")
  })
})

function createSingleFileZip(fileName: string, content: string): Buffer {
  const fileNameBytes = Buffer.from(fileName, "utf8")
  const contentBytes = Buffer.from(content, "utf8")
  const localHeader = Buffer.alloc(30)

  localHeader.writeUInt32LE(0x04034b50, 0)
  localHeader.writeUInt16LE(20, 4)
  localHeader.writeUInt16LE(0, 6)
  localHeader.writeUInt16LE(0, 8)
  localHeader.writeUInt16LE(0, 10)
  localHeader.writeUInt16LE(0, 12)
  localHeader.writeUInt32LE(0, 14)
  localHeader.writeUInt32LE(contentBytes.length, 18)
  localHeader.writeUInt32LE(contentBytes.length, 22)
  localHeader.writeUInt16LE(fileNameBytes.length, 26)
  localHeader.writeUInt16LE(0, 28)

  const centralHeader = Buffer.alloc(46)
  centralHeader.writeUInt32LE(0x02014b50, 0)
  centralHeader.writeUInt16LE(20, 4)
  centralHeader.writeUInt16LE(20, 6)
  centralHeader.writeUInt16LE(0, 8)
  centralHeader.writeUInt16LE(0, 10)
  centralHeader.writeUInt16LE(0, 12)
  centralHeader.writeUInt16LE(0, 14)
  centralHeader.writeUInt32LE(0, 16)
  centralHeader.writeUInt32LE(contentBytes.length, 20)
  centralHeader.writeUInt32LE(contentBytes.length, 24)
  centralHeader.writeUInt16LE(fileNameBytes.length, 28)
  centralHeader.writeUInt16LE(0, 30)
  centralHeader.writeUInt16LE(0, 32)
  centralHeader.writeUInt16LE(0, 34)
  centralHeader.writeUInt16LE(0, 36)
  centralHeader.writeUInt32LE(0, 38)
  centralHeader.writeUInt32LE(localHeader.length + fileNameBytes.length + contentBytes.length, 42)

  const centralStart = localHeader.length + fileNameBytes.length + contentBytes.length
  const central = Buffer.concat([centralHeader, fileNameBytes])
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(centralStart, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([localHeader, fileNameBytes, contentBytes, central, end])
}
