import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { isAbsolute, join, parse, relative, resolve } from "node:path"

import { validateLocalSkillName } from "@/core/local-skills/local-skill-inventory-service"

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

function toZipPath(rootPath: string, filePath: string): string {
  const relativePath = relative(rootPath, filePath)
  const zipPath = relativePath.replace(/\\/g, "/")

  if (
    !zipPath ||
    zipPath.startsWith("../") ||
    zipPath === ".." ||
    isAbsolute(zipPath) ||
    zipPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe local skill package path: ${relativePath}`)
  }

  return zipPath
}

function isSameOrInsidePath(pathValue: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, pathValue)

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  )
}

async function collectZipEntries(args: {
  rootPath: string
  currentPath: string
  rootRealPath: string
  maxFileCount: number
  maxTotalBytes: number
  state: {
    fileCount: number
    totalBytes: number
  }
}): Promise<ZipEntry[]> {
  const entries = await readdir(args.currentPath, { withFileTypes: true })
  const collected: ZipEntry[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = join(args.currentPath, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error(`Local skill package cannot include symbolic links: ${entry.name}`)
    }

    if (entry.isDirectory()) {
      collected.push(
        ...(await collectZipEntries({
          ...args,
          currentPath: entryPath
        }))
      )
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const entryRealPath = await realpath(entryPath)

    if (!isSameOrInsidePath(entryRealPath, args.rootRealPath)) {
      throw new Error(`Local skill package path escapes the package root: ${entry.name}`)
    }

    const fileStat = await lstat(entryPath)

    if (!fileStat.isFile()) {
      continue
    }

    args.state.fileCount += 1

    if (args.state.fileCount > args.maxFileCount) {
      throw new Error("Local skill package exceeds the file count limit")
    }

    args.state.totalBytes += fileStat.size

    if (args.state.totalBytes > args.maxTotalBytes) {
      throw new Error("Local skill package exceeds the upload size limit")
    }

    const bytes = await readFile(entryPath)
    collected.push({
      relativePath: toZipPath(args.rootPath, entryPath),
      bytes,
      crc32: crc32(bytes)
    })
  }

  return collected
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

  try {
    const skillMdStat = await lstat(join(packageRootPath, "SKILL.md"))

    if (!skillMdStat.isFile()) {
      throw new Error("Root SKILL.md is required before uploading a local skill")
    }
  } catch {
    throw new Error("Root SKILL.md is required before uploading a local skill")
  }

  const rootRealPath = await realpath(packageRootPath)
  const entries = await collectZipEntries({
    rootPath: packageRootPath,
    currentPath: packageRootPath,
    rootRealPath,
    maxFileCount: request.maxFileCount ?? DEFAULT_MAX_FILE_COUNT,
    maxTotalBytes: request.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
    state: {
      fileCount: 0,
      totalBytes: 0
    }
  })

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
