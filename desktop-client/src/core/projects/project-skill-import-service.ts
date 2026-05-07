import { copyFile, lstat, mkdir, readdir, readFile, rm } from "node:fs/promises"
import { join, posix, win32 } from "node:path"

import type { AgentPathDefinition } from "@/adapters/agents/definitions"
import { resolveProjectAgentTargets } from "@/core/projects/project-agent-targets"
import {
  createProjectSkillValidationMessage,
  parseProjectSkillFrontmatter,
  resolveProjectSkillIdentity
} from "@/core/projects/project-skill-metadata"
import type {
  AgentId,
  LocalSkillValidationState,
  ProjectEntry,
  ProjectSkillFolderValidation,
  ProjectSkillImportResult
} from "@/types"

export interface ProjectSkillImportServiceOptions {
  definitions?: AgentPathDefinition[]
  maxFileCount?: number
  maxTotalBytes?: number
  platform?: NodeJS.Platform
}

export interface ProjectSkillFolderValidationPayload {
  sourcePath: string
}

export interface ProjectSkillImportPayload {
  project: ProjectEntry
  sourcePath: string
  targetAgentId: AgentId
  overwrite: boolean
}

export interface ProjectSkillImportService {
  validateSkillFolder(payload: ProjectSkillFolderValidationPayload): Promise<ProjectSkillFolderValidation>
  importSkill(payload: ProjectSkillImportPayload): Promise<ProjectSkillImportResult>
}

type SourceStats = {
  fileCount: number
  totalBytes: number
}

const DEFAULT_MAX_FILE_COUNT = 1_000
const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix
}

function normalizeAbsolutePath(pathValue: string, platform: NodeJS.Platform): string {
  const pathModule = getPathModule(platform)
  const trimmed = pathValue.trim()

  if (!trimmed) {
    throw new Error("Path cannot be empty")
  }

  const normalized = pathModule.normalize(trimmed)

  if (!pathModule.isAbsolute(normalized)) {
    throw new Error("Path must be absolute")
  }

  return normalized
}

function assertPathInside(
  basePath: string,
  targetPath: string,
  platform: NodeJS.Platform,
  allowEqual = false
): void {
  const pathModule = getPathModule(platform)
  const relativePath = pathModule.relative(pathModule.normalize(basePath), pathModule.normalize(targetPath))

  if (allowEqual && relativePath === "") {
    return
  }

  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${pathModule.sep}`) ||
    pathModule.isAbsolute(relativePath)
  ) {
    throw new Error(`Resolved path escapes its allowed root: ${targetPath}`)
  }
}

function createInvalidValidation(args: {
  sourcePath: string
  validationState: LocalSkillValidationState
  error?: unknown
}): ProjectSkillFolderValidation {
  return {
    valid: false,
    identity: null,
    version: null,
    description: null,
    sourcePath: args.sourcePath,
    validationState: args.validationState,
    validationMessage: createProjectSkillValidationMessage(args.validationState, args.error)
  }
}

export function createProjectSkillImportService(
  options: ProjectSkillImportServiceOptions = {}
): ProjectSkillImportService {
  const definitions = options.definitions
  const maxFileCount = options.maxFileCount ?? DEFAULT_MAX_FILE_COUNT
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES
  const platform = options.platform ?? process.platform
  const pathModule = getPathModule(platform)

  async function walkSource(sourceRoot: string, currentPath: string, totals: SourceStats): Promise<void> {
    const stats = await lstat(currentPath)

    if (stats.isSymbolicLink()) {
      throw new Error(`Skill import rejects symlink entries: ${currentPath}`)
    }

    assertPathInside(sourceRoot, currentPath, platform, true)

    if (stats.isDirectory()) {
      const entries = await readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        await walkSource(sourceRoot, join(currentPath, entry.name), totals)
      }

      return
    }

    if (!stats.isFile()) {
      throw new Error(`Skill import only supports regular files and directories: ${currentPath}`)
    }

    totals.fileCount += 1
    totals.totalBytes += stats.size

    if (totals.fileCount > maxFileCount) {
      throw new Error(`Skill import source has too many files (${totals.fileCount}/${maxFileCount})`)
    }

    if (totals.totalBytes > maxTotalBytes) {
      throw new Error(
        `Skill import source is too large (${totals.totalBytes}/${maxTotalBytes} bytes)`
      )
    }
  }

  async function validateSource(sourcePathValue: string): Promise<ProjectSkillFolderValidation> {
    let sourcePath: string

    try {
      sourcePath = normalizeAbsolutePath(sourcePathValue, platform)
    } catch (error) {
      return createInvalidValidation({
        sourcePath: String(sourcePathValue ?? ""),
        validationState: "not-directory",
        error
      })
    }

    try {
      const sourceStats = await lstat(sourcePath)

      if (sourceStats.isSymbolicLink() || !sourceStats.isDirectory()) {
        return createInvalidValidation({
          sourcePath,
          validationState: "not-directory",
          error: new Error("Source skill path must be a directory")
        })
      }
    } catch (error) {
      return createInvalidValidation({
        sourcePath,
        validationState: "not-directory",
        error
      })
    }

    let skillMarkdown: string

    try {
      skillMarkdown = String(await readFile(join(sourcePath, "SKILL.md"), "utf8"))
    } catch (error) {
      return createInvalidValidation({
        sourcePath,
        validationState:
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "ENOENT"
            ? "missing-skill-md"
            : "unreadable",
        error
      })
    }

    const metadata = parseProjectSkillFrontmatter(skillMarkdown)
    const identity = resolveProjectSkillIdentity(metadata)

    if (!identity.identity) {
      return {
        valid: false,
        identity: null,
        version: metadata.version,
        description: metadata.description,
        sourcePath,
        validationState: identity.validationState,
        validationMessage: identity.validationMessage
      }
    }

    try {
      await walkSource(sourcePath, sourcePath, {
        fileCount: 0,
        totalBytes: 0
      })
    } catch (error) {
      return createInvalidValidation({
        sourcePath,
        validationState: "unreadable",
        error
      })
    }

    return {
      valid: true,
      identity: identity.identity,
      version: metadata.version,
      description: metadata.description,
      sourcePath,
      validationState: "valid",
      validationMessage: null
    }
  }

  async function copyTree(sourceRoot: string, destinationRoot: string, currentSource: string): Promise<void> {
    const relativePath = pathModule.relative(sourceRoot, currentSource)
    const destinationPath =
      relativePath === "" ? destinationRoot : pathModule.join(destinationRoot, relativePath)
    const stats = await lstat(currentSource)

    if (stats.isSymbolicLink()) {
      throw new Error(`Skill import rejects symlink entries: ${currentSource}`)
    }

    assertPathInside(sourceRoot, currentSource, platform, true)

    if (stats.isDirectory()) {
      await mkdir(destinationPath, { recursive: true })

      const entries = await readdir(currentSource, { withFileTypes: true })

      for (const entry of entries) {
        await copyTree(sourceRoot, destinationRoot, join(currentSource, entry.name))
      }

      return
    }

    if (!stats.isFile()) {
      throw new Error(`Skill import only supports regular files and directories: ${currentSource}`)
    }

    await mkdir(pathModule.dirname(destinationPath), { recursive: true })
    await copyFile(currentSource, destinationPath)
  }

  return {
    validateSkillFolder(payload: ProjectSkillFolderValidationPayload) {
      return validateSource(payload.sourcePath)
    },
    async importSkill(payload: ProjectSkillImportPayload): Promise<ProjectSkillImportResult> {
      const validation = await validateSource(payload.sourcePath)

      if (!validation.valid || !validation.identity) {
        throw new Error(validation.validationMessage ?? "Source skill folder is invalid")
      }

      const projectRoot = normalizeAbsolutePath(payload.project.path, platform)
      const targets = resolveProjectAgentTargets(payload.project, {
        definitions,
        platform
      })
      const target = targets.find((candidate) =>
        candidate.writableAgentIds.includes(payload.targetAgentId)
      )

      if (!target) {
        throw new Error(`No writable project target for agent: ${payload.targetAgentId}`)
      }

      const destinationPath = pathModule.normalize(
        pathModule.join(target.targetPath, validation.identity)
      )

      assertPathInside(projectRoot, target.targetPath, platform)
      assertPathInside(target.targetPath, destinationPath, platform)

      let destinationExists = false

      try {
        destinationExists = (await lstat(destinationPath)).isDirectory()
      } catch (error) {
        if (
          !(
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "ENOENT"
          )
        ) {
          throw error
        }
      }

      if (destinationExists && !payload.overwrite) {
        throw new Error(`Project skill already exists at target: ${destinationPath}`)
      }

      if (destinationExists) {
        assertPathInside(target.targetPath, destinationPath, platform)
        await rm(destinationPath, { recursive: true, force: true })
      }

      await mkdir(target.targetPath, { recursive: true })
      await copyTree(validation.sourcePath, destinationPath, validation.sourcePath)
      await readFile(join(destinationPath, "SKILL.md"), "utf8")

      return {
        projectId: payload.project.id,
        identity: validation.identity,
        targetPath: destinationPath,
        overwritten: destinationExists
      }
    }
  }
}
