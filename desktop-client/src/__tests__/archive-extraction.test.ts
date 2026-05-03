import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { extractZipArchive } from "@/core/distribution/archive-extraction"

type ZipEntry = {
  content?: string
  externalAttributes?: number
  name: string
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  return value >>> 0
})

function crc32(bytes: Buffer): number {
  let value = 0xffffffff

  for (const byte of bytes) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  }

  return (value ^ 0xffffffff) >>> 0
}

function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name)
    const contentBytes = Buffer.from(entry.content ?? "")
    const checksum = crc32(contentBytes)
    const localHeader = Buffer.alloc(30)

    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(contentBytes.length, 18)
    localHeader.writeUInt32LE(contentBytes.length, 22)
    localHeader.writeUInt16LE(nameBytes.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, nameBytes, contentBytes)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(0x031e, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(contentBytes.length, 20)
    centralHeader.writeUInt32LE(contentBytes.length, 24)
    centralHeader.writeUInt16LE(nameBytes.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE((entry.externalAttributes ?? (0o100644 << 16)) >>> 0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, nameBytes)

    offset += localHeader.length + nameBytes.length + contentBytes.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, end])
}

describe("archive extraction", () => {
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
    const root = mkdtempSync(join(tmpdir(), "skilldrive-archive-extraction-"))
    tempRoots.push(root)
    return root
  }

  function writeZip(root: string, entries: ZipEntry[]): string {
    const archivePath = join(root, "package.zip")
    writeFileSync(archivePath, createZip(entries))
    return archivePath
  }

  it("extracts a valid skill archive into the requested directory", async () => {
    const root = createTempRoot()
    const archivePath = writeZip(root, [
      { name: "SKILL.md", content: "---\nversion: 1.0.0\n---\n# Skill" },
      { name: "nested/README.md", content: "# Nested" }
    ])
    const extractedPath = join(root, "extracted")

    await extractZipArchive(archivePath, extractedPath)

    expect(readFileSync(join(extractedPath, "SKILL.md"), "utf8")).toContain("# Skill")
    expect(readFileSync(join(extractedPath, "nested", "README.md"), "utf8")).toBe("# Nested")
  })

  it("rejects traversal entries before writing outside the target directory", async () => {
    const root = createTempRoot()
    const archivePath = writeZip(root, [{ name: "../escape.txt", content: "escape" }])
    const extractedPath = join(root, "extracted")

    await expect(extractZipArchive(archivePath, extractedPath)).rejects.toThrow(
      "invalid relative path"
    )

    expect(existsSync(join(root, "escape.txt"))).toBe(false)
  })

  it("rejects absolute archive entry paths", async () => {
    const root = createTempRoot()
    const archivePath = writeZip(root, [{ name: "/absolute.txt", content: "escape" }])
    const extractedPath = join(root, "extracted")

    await expect(extractZipArchive(archivePath, extractedPath)).rejects.toThrow(
      /absolute path/i
    )

    expect(existsSync(join(extractedPath, "absolute.txt"))).toBe(false)
  })

  it("rejects symlink entries instead of materializing links", async () => {
    const root = createTempRoot()
    const archivePath = writeZip(root, [
      {
        name: "link-to-outside",
        content: "../outside",
        externalAttributes: (0o120777 << 16) >>> 0
      }
    ])
    const extractedPath = join(root, "extracted")

    await expect(extractZipArchive(archivePath, extractedPath)).rejects.toThrow(
      "Symbolic links are not allowed"
    )

    expect(existsSync(join(extractedPath, "link-to-outside"))).toBe(false)
  })

  it("requires the extraction destination to be absolute", async () => {
    const root = createTempRoot()
    const archivePath = writeZip(root, [{ name: "SKILL.md", content: "# Skill" }])

    await expect(extractZipArchive(archivePath, "relative-output")).rejects.toThrow(
      "Extraction directory must be absolute"
    )
  })

  it("creates nested extraction destinations before extracting", async () => {
    const root = createTempRoot()
    const archivePath = writeZip(root, [{ name: "SKILL.md", content: "# Skill" }])
    const extractedPath = join(root, "missing", "nested", "output")

    await mkdir(dirname(extractedPath), { recursive: true })
    await extractZipArchive(archivePath, extractedPath)

    expect(readFileSync(join(extractedPath, "SKILL.md"), "utf8")).toBe("# Skill")
  })
})
