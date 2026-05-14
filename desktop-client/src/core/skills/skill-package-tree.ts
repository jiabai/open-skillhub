import { copyFile, lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises"
import { dirname, isAbsolute, join, relative } from "node:path"

export type SkillPackageTreeErrorCode =
  | "symlink"
  | "path-escape"
  | "too-many-files"
  | "too-large"
  | "non-regular"

export interface SkillPackageTreeFile {
  absolutePath: string
  relativePath: string
  size: number
  bytes?: Buffer
}

export interface CollectSkillPackageTreeFilesRequest {
  rootPath: string
  maxFileCount: number
  maxTotalBytes: number
  includeBytes?: boolean
  ignoredDirectoryNames?: string[]
  rejectNonRegular?: boolean
}

export interface CopySkillPackageTreeRequest {
  sourceRoot: string
  destinationRoot: string
  maxFileCount: number
  maxTotalBytes: number
  ignoredDirectoryNames?: string[]
}

export class SkillPackageTreeError extends Error {
  readonly code: SkillPackageTreeErrorCode
  readonly path?: string

  constructor(code: SkillPackageTreeErrorCode, message: string, path?: string) {
    super(message)
    this.name = "SkillPackageTreeError"
    this.code = code
    this.path = path
  }
}

export function isSameOrInsidePath(pathValue: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, pathValue)

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))
}

function toPackageRelativePath(rootPath: string, filePath: string): string {
  const relativePath = relative(rootPath, filePath)
  const normalized = relativePath.replace(/\\/g, "/")

  if (
    !normalized ||
    normalized.startsWith("../") ||
    normalized === ".." ||
    isAbsolute(normalized) ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new SkillPackageTreeError("path-escape", "Skill package path escapes the package root", filePath)
  }

  return normalized
}

function sortPackageEntries(entries: SkillPackageTreeFile[]): SkillPackageTreeFile[] {
  return [...entries].sort((left, right) => {
    if (left.relativePath === "SKILL.md") {
      return -1
    }

    if (right.relativePath === "SKILL.md") {
      return 1
    }

    return left.relativePath.localeCompare(right.relativePath)
  })
}

export async function assertRootSkillFile(rootPath: string, message = "Root SKILL.md is required"): Promise<void> {
  try {
    const skillMd = await lstat(join(rootPath, "SKILL.md"))

    if (!skillMd.isFile()) {
      throw new Error(message)
    }
  } catch {
    throw new Error(message)
  }
}

export async function collectSkillPackageTreeFiles(
  request: CollectSkillPackageTreeFilesRequest
): Promise<SkillPackageTreeFile[]> {
  const rootRealPath = await realpath(request.rootPath)
  const ignoredDirectoryNames = new Set(request.ignoredDirectoryNames ?? [])
  const state = {
    fileCount: 0,
    totalBytes: 0
  }
  const collected: SkillPackageTreeFile[] = []

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true })

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = join(currentPath, entry.name)

      if (entry.isSymbolicLink()) {
        throw new SkillPackageTreeError(
          "symlink",
          "Skill package cannot include symbolic links",
          entryPath
        )
      }

      const entryStat = await lstat(entryPath)
      const entryRealPath = await realpath(entryPath)

      if (!isSameOrInsidePath(entryRealPath, rootRealPath)) {
        throw new SkillPackageTreeError(
          "path-escape",
          "Skill package path escapes the package root",
          entryPath
        )
      }

      if (entryStat.isDirectory()) {
        if (ignoredDirectoryNames.has(entry.name)) {
          continue
        }

        await walk(entryPath)
        continue
      }

      if (!entryStat.isFile()) {
        if (request.rejectNonRegular) {
          throw new SkillPackageTreeError(
            "non-regular",
            "Skill package only supports regular files and directories",
            entryPath
          )
        }

        continue
      }

      state.fileCount += 1

      if (state.fileCount > request.maxFileCount) {
        throw new SkillPackageTreeError(
          "too-many-files",
          "Skill package exceeds the file count limit",
          entryPath
        )
      }

      state.totalBytes += entryStat.size

      if (state.totalBytes > request.maxTotalBytes) {
        throw new SkillPackageTreeError("too-large", "Skill package exceeds the size limit", entryPath)
      }

      collected.push({
        absolutePath: entryPath,
        relativePath: toPackageRelativePath(request.rootPath, entryPath),
        size: entryStat.size,
        ...(request.includeBytes ? { bytes: await readFile(entryPath) } : {})
      })
    }
  }

  await walk(request.rootPath)

  return sortPackageEntries(collected)
}

export async function copySkillPackageTree(request: CopySkillPackageTreeRequest): Promise<void> {
  const entries = await collectSkillPackageTreeFiles({
    rootPath: request.sourceRoot,
    maxFileCount: request.maxFileCount,
    maxTotalBytes: request.maxTotalBytes,
    ignoredDirectoryNames: request.ignoredDirectoryNames,
    rejectNonRegular: true
  })

  for (const entry of entries) {
    const destinationPath = join(request.destinationRoot, entry.relativePath)
    await mkdir(dirname(destinationPath), { recursive: true })
    await copyFile(entry.absolutePath, destinationPath)
  }
}
