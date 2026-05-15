import { lstat, mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { extname, isAbsolute, join, parse, resolve } from "node:path"

import { extractZipArchive } from "@/core/distribution/archive-extraction"
import {
  assertRootSkillFile,
  collectSkillPackageTreeFiles,
  SkillPackageTreeError
} from "@/core/skills/skill-package-tree"
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
      throw new Error("Local skill package exceeds the size limit")
    }
  }

  throw error
}

async function validatePackageTree(
  packageRoot: string,
  request: PrepareCliLocalPackageSourceRequest
): Promise<void> {
  try {
    await collectSkillPackageTreeFiles({
      rootPath: packageRoot,
      maxFileCount: request.maxFileCount ?? DEFAULT_MAX_FILE_COUNT,
      maxTotalBytes: request.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES
    })
  } catch (error) {
    mapPackageTreeError(error)
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

  await assertRootSkillFile(packageRoot)
  await validatePackageTree(packageRoot, request)

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
    await assertRootSkillFile(extractedPath)
    await validatePackageTree(extractedPath, request)

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
