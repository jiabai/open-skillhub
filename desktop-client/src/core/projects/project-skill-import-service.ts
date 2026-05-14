import { lstat, mkdir, readFile, rm } from "node:fs/promises"
import { join, posix, win32 } from "node:path"

import type { AgentPathDefinition } from "@/adapters/agents/definitions"
import { resolveSkillInstallPath } from "@/adapters/agents/skill-layout"
import { resolveProjectAgentTargets } from "@/core/projects/project-agent-targets"
import {
  collectSkillPackageTreeFiles,
  copySkillPackageTree,
  SkillPackageTreeError
} from "@/core/skills/skill-package-tree"
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

  function mapPackageTreeError(error: unknown): never {
    if (error instanceof SkillPackageTreeError) {
      if (error.code === "symlink") {
        throw new Error(`Skill import rejects symlink entries: ${error.path ?? ""}`)
      }

      if (error.code === "path-escape") {
        throw new Error(`Resolved path escapes its allowed root: ${error.path ?? ""}`)
      }

      if (error.code === "too-many-files") {
        throw new Error(`Skill import source has too many files`)
      }

      if (error.code === "too-large") {
        throw new Error(`Skill import source is too large`)
      }

      if (error.code === "non-regular") {
        throw new Error(`Skill import only supports regular files and directories: ${error.path ?? ""}`)
      }
    }

    throw error
  }

  async function validatePackageTree(sourcePath: string): Promise<void> {
    try {
      await collectSkillPackageTreeFiles({
        rootPath: sourcePath,
        maxFileCount,
        maxTotalBytes,
        rejectNonRegular: true
      })
    } catch (error) {
      mapPackageTreeError(error)
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
      await validatePackageTree(sourcePath)
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

  async function copyTree(sourceRoot: string, destinationRoot: string): Promise<void> {
    try {
      await copySkillPackageTree({
        sourceRoot,
        destinationRoot,
        maxFileCount,
        maxTotalBytes
      })
    } catch (error) {
      mapPackageTreeError(error)
    }
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
        resolveSkillInstallPath(target.targetPath, validation.identity, target.skillLayout)
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
      await copyTree(validation.sourcePath, destinationPath)
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
