import { createHash } from "node:crypto"
import { readFile, readdir, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, join, posix, win32 } from "node:path"

import { type AgentPathDefinition } from "@/adapters/agents/definitions"
import { resolveProjectAgentTargets } from "@/core/projects/project-agent-targets"
import {
  createProjectSkillValidationMessage,
  parseProjectSkillFrontmatter,
  resolveProjectSkillIdentity
} from "@/core/projects/project-skill-metadata"
import type {
  LocalSkillValidationState,
  LocalSkillsInventorySnapshot,
  ProjectEntry,
  ProjectSkillRow,
  ProjectSkillScanSnapshot
} from "@/types"

export interface ProjectSkillScanServiceOptions {
  definitions?: AgentPathDefinition[]
  homeDir?: () => string
  now?: () => Date
  platform?: NodeJS.Platform
  readDirectory?: (path: string, options: { withFileTypes: true }) => Promise<DirectoryEntry[]>
  readTextFile?: (path: string, encoding: BufferEncoding) => Promise<string | Buffer>
  statPath?: (path: string) => Promise<{ isDirectory(): boolean }>
}

export interface ProjectSkillScanInput {
  project: ProjectEntry
  globalSnapshot: LocalSkillsInventorySnapshot | null
}

export interface ProjectSkillScanService {
  scan(input: ProjectSkillScanInput): Promise<ProjectSkillScanSnapshot>
}

type DirectoryEntry = {
  name: string
  isDirectory(): boolean
}

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix
}

function createDedupeKey(pathValue: string, platform: NodeJS.Platform): string {
  const normalized = getPathModule(platform).normalize(pathValue)

  return platform === "win32" ? normalized.toLocaleLowerCase() : normalized
}

function createRowKey(args: {
  source: "project" | "global"
  path: string
  identity: string | null
  platform: NodeJS.Platform
}): string {
  return createHash("sha256")
    .update(`${args.source}\0${createDedupeKey(args.path, args.platform)}\0${args.identity ?? ""}`)
    .digest("hex")
    .slice(0, 24)
}

function createRelativePath(projectPath: string, skillPath: string, platform: NodeJS.Platform): string {
  const pathModule = getPathModule(platform)
  return pathModule.normalize(pathModule.relative(pathModule.normalize(projectPath), skillPath))
}

function isPathInside(basePath: string, childPath: string, platform: NodeJS.Platform): boolean {
  const pathModule = getPathModule(platform)
  const relativePath = pathModule.relative(pathModule.normalize(basePath), pathModule.normalize(childPath))

  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${pathModule.sep}`) &&
    !pathModule.isAbsolute(relativePath)
  )
}

function sortProjectRows(rows: ProjectSkillRow[]): ProjectSkillRow[] {
  return [...rows].sort((left, right) => {
    if (left.validationState === "valid" && right.validationState !== "valid") {
      return -1
    }

    if (left.validationState !== "valid" && right.validationState === "valid") {
      return 1
    }

    const leftLabel = left.identity ?? basename(left.skillPath)
    const rightLabel = right.identity ?? basename(right.skillPath)
    const identityComparison = leftLabel.localeCompare(rightLabel)

    return identityComparison === 0 ? left.skillPath.localeCompare(right.skillPath) : identityComparison
  })
}

export function createProjectSkillScanService(
  options: ProjectSkillScanServiceOptions = {}
): ProjectSkillScanService {
  const definitions = options.definitions
  const homeDir = options.homeDir ?? (() => process.env.HOME ?? process.env.USERPROFILE ?? homedir())
  const now = options.now ?? (() => new Date())
  const platform = options.platform ?? process.platform
  const pathModule = getPathModule(platform)
  const readDirectory =
    options.readDirectory ??
    ((pathValue: string, readdirOptions: { withFileTypes: true }) =>
      readdir(pathValue, readdirOptions))
  const readTextFile =
    options.readTextFile ??
    ((pathValue: string, encoding: BufferEncoding) => readFile(pathValue, encoding))
  const statPath = options.statPath ?? ((pathValue: string) => stat(pathValue))

  async function buildProjectRow(args: {
    project: ProjectEntry
    skillPath: string
    agentIds: ProjectSkillRow["agentIds"]
    displayNames: string[]
  }): Promise<ProjectSkillRow> {
    let identity: string | null = null
    let version: string | null = null
    let description: string | null = null
    let validationState: LocalSkillValidationState = "valid"
    let validationMessage: string | null = null

    try {
      const skillMarkdown = await readTextFile(join(args.skillPath, "SKILL.md"), "utf8")
      const metadata = parseProjectSkillFrontmatter(String(skillMarkdown))
      const identityResult = resolveProjectSkillIdentity(metadata)

      identity = identityResult.identity
      version = metadata.version
      description = metadata.description
      validationState = identityResult.validationState
      validationMessage = identityResult.validationMessage
    } catch (error) {
      validationState =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
          ? "missing-skill-md"
          : "unreadable"
      validationMessage = createProjectSkillValidationMessage(validationState, error)
    }

    return {
      rowKey: createRowKey({
        source: "project",
        path: args.skillPath,
        identity,
        platform
      }),
      identity,
      version,
      description,
      source: "project",
      agentIds: args.agentIds,
      sourceDisplayNames: args.displayNames,
      skillPath: args.skillPath,
      relativePath: createRelativePath(args.project.path, args.skillPath, platform),
      validationState,
      validationMessage
    }
  }

  function createGlobalRows(
    globalSnapshot: LocalSkillsInventorySnapshot | null,
    projectIdentities: Set<string>
  ): ProjectSkillRow[] {
    if (!globalSnapshot) {
      return []
    }

    const globalAgentsSkillsPath = pathModule.normalize(pathModule.join(homeDir(), ".agents", "skills"))

    return globalSnapshot.rows
      .filter(
        (row) =>
          row.name !== null &&
          !projectIdentities.has(row.name) &&
          isPathInside(globalAgentsSkillsPath, row.packageRootPath, platform)
      )
      .map((row) => ({
        rowKey: `global-${row.rowKey}`,
        identity: row.name,
        version: row.localVersion,
        description: null,
        source: "global" as const,
        agentIds: row.sourceAgents,
        sourceDisplayNames: row.sourceDisplayNames,
        skillPath: row.packageRootPath,
        relativePath: null,
        validationState: row.validationState,
        validationMessage: row.validationMessage
      }))
  }

  return {
    async scan(input: ProjectSkillScanInput): Promise<ProjectSkillScanSnapshot> {
      const errors: string[] = []
      const targets = resolveProjectAgentTargets(input.project, {
        definitions,
        platform
      })

      try {
        const projectStats = await statPath(input.project.path)

        if (!projectStats.isDirectory()) {
          errors.push(`Project path is not a directory: ${input.project.path}`)
        }
      } catch (error) {
        errors.push(
          `Project path could not be read: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }

      if (errors.length > 0) {
        return {
          projectId: input.project.id,
          checkedAt: now().toISOString(),
          project: input.project,
          targets,
          rows: createGlobalRows(input.globalSnapshot, new Set()),
          errors
        }
      }

      const projectRows: ProjectSkillRow[] = []
      const seenProjectIdentities = new Set<string>()
      const seenProjectPaths = new Set<string>()

      for (const target of targets) {
        let entries: DirectoryEntry[]

        try {
          entries = await readDirectory(target.targetPath, { withFileTypes: true })
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "ENOENT"
          ) {
            continue
          }

          errors.push(
            `Failed to scan ${target.relativePath}: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
          continue
        }

        for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
          if (!entry.isDirectory()) {
            continue
          }

          const skillPath = pathModule.normalize(pathModule.join(target.targetPath, entry.name))
          const pathKey = createDedupeKey(skillPath, platform)

          if (seenProjectPaths.has(pathKey)) {
            continue
          }

          seenProjectPaths.add(pathKey)

          const row = await buildProjectRow({
            project: input.project,
            skillPath,
            agentIds: target.coveredAgentIds,
            displayNames: target.displayNames
          })

          if (row.identity !== null) {
            if (seenProjectIdentities.has(row.identity)) {
              continue
            }

            seenProjectIdentities.add(row.identity)
          }

          projectRows.push(row)
        }
      }

      return {
        projectId: input.project.id,
        checkedAt: now().toISOString(),
        project: input.project,
        targets,
        rows: [
          ...sortProjectRows(projectRows),
          ...createGlobalRows(input.globalSnapshot, seenProjectIdentities)
        ],
        errors
      }
    }
  }
}
