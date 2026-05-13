import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises"
import { extname, isAbsolute, join, parse, relative, resolve } from "node:path"

import { extractZipArchive } from "@/core/distribution/archive-extraction"
import {
  parseProjectSkillFrontmatter,
  resolveProjectSkillIdentity
} from "@/core/projects/project-skill-metadata"
import type { PreparedSkillPackage } from "@/types"

const DEFAULT_MAX_FILE_COUNT = 1_000
const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024

export interface PrepareCliLocalPackageSourceRequest {
  sourcePath: string
  cacheDir: string
  maxFileCount?: number
  maxTotalBytes?: number
}

function normalizeLocalPath(pathValue: string, label: string): string {
  const normalized = resolve(pathValue)

  if (!isAbsolute(normalized) || normalized === parse(normalized).root) {
    throw new Error(`Invalid ${label}: ${pathValue}`)
  }

  return normalized
}

function isSameOrInsidePath(pathValue: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, pathValue)

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))
}

async function readPackageIdentity(packageRoot: string): Promise<Pick<PreparedSkillPackage, "skillId" | "name" | "version">> {
  let skillMarkdown: string

  try {
    skillMarkdown = await readFile(join(packageRoot, "SKILL.md"), "utf8")
  } catch {
    throw new Error("Root SKILL.md is required")
  }

  const metadata = parseProjectSkillFrontmatter(skillMarkdown)
  const identity = resolveProjectSkillIdentity(metadata)

  if (!identity.identity) {
    throw new Error(identity.validationMessage ?? "SKILL.md frontmatter is missing a usable slug or name")
  }

  return {
    skillId: `local:${identity.identity}`,
    name: identity.identity,
    version: metadata.version
  }
}

async function assertSkillMdFile(packageRoot: string): Promise<void> {
  try {
    const skillMd = await lstat(join(packageRoot, "SKILL.md"))

    if (!skillMd.isFile()) {
      throw new Error("Root SKILL.md is required")
    }
  } catch {
    throw new Error("Root SKILL.md is required")
  }
}

async function validatePackageTree(args: {
  rootPath: string
  currentPath: string
  rootRealPath: string
  maxFileCount: number
  maxTotalBytes: number
  state: { fileCount: number; totalBytes: number }
}): Promise<void> {
  const entries = await readdir(args.currentPath, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = join(args.currentPath, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error(`Local skill package cannot include symbolic links: ${entry.name}`)
    }

    const entryStat = await lstat(entryPath)
    const entryRealPath = await realpath(entryPath)

    if (!isSameOrInsidePath(entryRealPath, args.rootRealPath)) {
      throw new Error(`Local skill package path escapes the package root: ${entry.name}`)
    }

    if (entryStat.isDirectory()) {
      await validatePackageTree({
        ...args,
        currentPath: entryPath
      })
      continue
    }

    if (!entryStat.isFile()) {
      continue
    }

    args.state.fileCount += 1

    if (args.state.fileCount > args.maxFileCount) {
      throw new Error("Local skill package exceeds the file count limit")
    }

    args.state.totalBytes += entryStat.size

    if (args.state.totalBytes > args.maxTotalBytes) {
      throw new Error("Local skill package exceeds the size limit")
    }
  }
}

async function validateDirectoryPackage(
  packageRoot: string,
  request: PrepareCliLocalPackageSourceRequest
): Promise<PreparedSkillPackage> {
  const rootStat = await lstat(packageRoot)

  if (!rootStat.isDirectory()) {
    throw new Error(`Local skill package root is not a directory: ${request.sourcePath}`)
  }

  await assertSkillMdFile(packageRoot)
  await validatePackageTree({
    rootPath: packageRoot,
    currentPath: packageRoot,
    rootRealPath: await realpath(packageRoot),
    maxFileCount: request.maxFileCount ?? DEFAULT_MAX_FILE_COUNT,
    maxTotalBytes: request.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
    state: { fileCount: 0, totalBytes: 0 }
  })

  return {
    ...(await readPackageIdentity(packageRoot)),
    extractedPath: packageRoot,
    async cleanup(): Promise<void> {
      return
    }
  }
}

async function validateZipPackage(
  archivePath: string,
  request: PrepareCliLocalPackageSourceRequest
): Promise<PreparedSkillPackage> {
  const archiveStat = await lstat(archivePath)

  if (!archiveStat.isFile()) {
    throw new Error(`Local zip package is not a file: ${request.sourcePath}`)
  }

  await mkdir(request.cacheDir, { recursive: true })
  const tempRoot = await mkdtemp(join(request.cacheDir, "package-"))
  const extractedPath = join(tempRoot, "extracted")

  try {
    await mkdir(extractedPath, { recursive: true })
    await extractZipArchive(archivePath, extractedPath)
    await assertSkillMdFile(extractedPath)
    await validatePackageTree({
      rootPath: extractedPath,
      currentPath: extractedPath,
      rootRealPath: await realpath(extractedPath),
      maxFileCount: request.maxFileCount ?? DEFAULT_MAX_FILE_COUNT,
      maxTotalBytes: request.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
      state: { fileCount: 0, totalBytes: 0 }
    })

    const identity = await readPackageIdentity(extractedPath)

    return {
      ...identity,
      extractedPath,
      async cleanup(): Promise<void> {
        await rm(tempRoot, { recursive: true, force: true })
      }
    }
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true })
    throw error
  }
}

export async function prepareCliLocalPackageSource(
  request: PrepareCliLocalPackageSourceRequest
): Promise<PreparedSkillPackage> {
  const sourcePath = normalizeLocalPath(request.sourcePath, "local skill package source")
  const extension = extname(sourcePath).toLowerCase()

  if (extension === ".zip") {
    return validateZipPackage(sourcePath, request)
  }

  return validateDirectoryPackage(sourcePath, request)
}
