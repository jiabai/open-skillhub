import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { isAbsolute, join, parse, resolve } from "node:path"

import { validateLocalSkillName } from "@/core/local-skills/local-skill-inventory-service"
import {
  assertRootSkillFile,
  collectSkillPackageTreeFiles,
  SkillPackageTreeError
} from "@/core/skills/skill-package-tree"
import { SKILL_PACKAGE_IGNORED_DIRECTORY_NAMES } from "@/types"

const DEFAULT_MAX_FILE_COUNT = 1_000
const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024
const CRC32_TABLE = createCrc32Table()

export interface LocalSkillUploadPackageRequest {
  packageRootPath: string
  skillName: string
  cacheDirectory: string
  maxFileCount?: number
  maxTotalBytes?: number
}

export interface PreparedLocalSkillUploadPackage {
  artifactPath: string
  fileName: string
  cleanup(): Promise<void>
}

type ZipEntry = {
  relativePath: string
  bytes: Buffer
  crc32: number
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256)

  for (let value = 0; value < table.length; value += 1) {
    let current = value

    for (let bit = 0; bit < 8; bit += 1) {
      current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1
    }

    table[value] = current >>> 0
  }

  return table
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff]
  }

  return (crc ^ 0xffffffff) >>> 0
}

function sanitizeZipBaseName(value: string): string {
  const safeName = value.replace(/[^a-zA-Z0-9._-]+/g, "_")

  return safeName && safeName !== "." && safeName !== ".." ? safeName : "local-skill"
}

function normalizePackageRoot(pathValue: string): string {
  const normalized = resolve(pathValue)

  if (!isAbsolute(normalized) || normalized === parse(normalized).root) {
    throw new Error(`Invalid local skill package root: ${pathValue}`)
  }

  return normalized
}

function mapPackageTreeError(error: unknown): never {
  if (error instanceof SkillPackageTreeError) {
    if (error.code === "symlink") {
      throw new Error(`Local skill package cannot include symbolic links: ${error.path ?? ""}`)
    }

    if (error.code === "path-escape") {
      throw new Error(`Local skill package path escapes the package root: ${error.path ?? ""}`)
    }

    if (error.code === "too-many-files") {
      throw new Error("Local skill package exceeds the file count limit")
    }

    if (error.code === "too-large") {
      throw new Error("Local skill package exceeds the upload size limit")
    }
  }

  throw error
}

async function collectZipEntries(
  packageRootPath: string,
  request: LocalSkillUploadPackageRequest
): Promise<ZipEntry[]> {
  try {
    const entries = await collectSkillPackageTreeFiles({
      rootPath: packageRootPath,
      maxFileCount: request.maxFileCount ?? DEFAULT_MAX_FILE_COUNT,
      maxTotalBytes: request.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
      includeBytes: true,
      ignoredDirectoryNames: [...SKILL_PACKAGE_IGNORED_DIRECTORY_NAMES]
    })

    return entries.map((entry) => {
      if (!entry.bytes) {
        throw new Error(`Local skill package entry is missing bytes: ${entry.relativePath}`)
      }

      return {
        relativePath: entry.relativePath,
        bytes: entry.bytes,
        crc32: crc32(entry.bytes)
      }
    })
  } catch (error) {
    mapPackageTreeError(error)
  }
}

function writeZipUInt16(value: number): Buffer {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value, 0)
  return buffer
}

function writeZipUInt32(value: number): Buffer {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value >>> 0, 0)
  return buffer
}

function createLocalFileHeader(entry: ZipEntry): Buffer {
  const fileName = Buffer.from(entry.relativePath, "utf8")
  const header = Buffer.alloc(30)

  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(0, 12)
  header.writeUInt32LE(entry.crc32, 14)
  header.writeUInt32LE(entry.bytes.length, 18)
  header.writeUInt32LE(entry.bytes.length, 22)
  header.writeUInt16LE(fileName.length, 26)
  header.writeUInt16LE(0, 28)

  return Buffer.concat([header, fileName])
}

function createCentralDirectoryHeader(entry: ZipEntry, localHeaderOffset: number): Buffer {
  const fileName = Buffer.from(entry.relativePath, "utf8")
  const header = Buffer.alloc(46)

  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(0, 12)
  header.writeUInt16LE(0, 14)
  header.writeUInt32LE(entry.crc32, 16)
  header.writeUInt32LE(entry.bytes.length, 20)
  header.writeUInt32LE(entry.bytes.length, 24)
  header.writeUInt16LE(fileName.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(localHeaderOffset, 42)

  return Buffer.concat([header, fileName])
}

function createEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Buffer {
  return Buffer.concat([
    writeZipUInt32(0x06054b50),
    writeZipUInt16(0),
    writeZipUInt16(0),
    writeZipUInt16(entryCount),
    writeZipUInt16(entryCount),
    writeZipUInt32(centralDirectorySize),
    writeZipUInt32(centralDirectoryOffset),
    writeZipUInt16(0)
  ])
}

function createZipBuffer(entries: ZipEntry[]): Buffer {
  const orderedEntries = [...entries].sort((left, right) => {
    if (left.relativePath === "SKILL.md") {
      return -1
    }

    if (right.relativePath === "SKILL.md") {
      return 1
    }

    return left.relativePath.localeCompare(right.relativePath)
  })
  const fileParts: Buffer[] = []
  const centralDirectoryParts: Buffer[] = []
  let offset = 0

  for (const entry of orderedEntries) {
    const localHeader = createLocalFileHeader(entry)
    fileParts.push(localHeader, entry.bytes)
    centralDirectoryParts.push(createCentralDirectoryHeader(entry, offset))
    offset += localHeader.length + entry.bytes.length
  }

  const centralDirectory = Buffer.concat(centralDirectoryParts)
  const end = createEndOfCentralDirectory(entries.length, centralDirectory.length, offset)

  return Buffer.concat([...fileParts, centralDirectory, end])
}

export async function prepareLocalSkillUploadPackage(
  request: LocalSkillUploadPackageRequest
): Promise<PreparedLocalSkillUploadPackage> {
  const skillName = validateLocalSkillName(request.skillName)
  const packageRootPath = normalizePackageRoot(request.packageRootPath)
  const rootStat = await lstat(packageRootPath)

  if (!rootStat.isDirectory()) {
    throw new Error(`Local skill package root is not a directory: ${request.packageRootPath}`)
  }

  await assertRootSkillFile(packageRootPath, "Root SKILL.md is required before uploading a local skill")
  const entries = await collectZipEntries(packageRootPath, request)

  if (!entries.some((entry) => entry.relativePath === "SKILL.md")) {
    throw new Error("Root SKILL.md is required before uploading a local skill")
  }

  await mkdir(request.cacheDirectory, { recursive: true })
  const artifactRoot = await mkdtemp(join(request.cacheDirectory, "local-upload-"))
  const fileName = `${sanitizeZipBaseName(skillName)}.zip`
  const artifactPath = join(artifactRoot, fileName)

  try {
    await writeFile(artifactPath, createZipBuffer(entries))
  } catch (error) {
    await rm(artifactRoot, { recursive: true, force: true })
    throw error
  }

  return {
    artifactPath,
    fileName,
    async cleanup(): Promise<void> {
      await rm(artifactRoot, { recursive: true, force: true })
    }
  }
}
