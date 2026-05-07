import { randomUUID } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, posix, win32 } from "node:path"

import type {
  ProjectAddPayload,
  ProjectEntry,
  ProjectListSnapshot,
  ProjectRemovePayload,
  ProjectRenamePayload
} from "@/types"

export interface ProjectConfigStoreOptions {
  idFactory?: () => string
  now?: () => Date
  platform?: NodeJS.Platform
}

export interface ProjectConfigStore {
  listProjects(): Promise<ProjectListSnapshot>
  addProject(payload: ProjectAddPayload): Promise<ProjectListSnapshot>
  renameProject(payload: ProjectRenamePayload): Promise<ProjectListSnapshot>
  removeProject(payload: ProjectRemovePayload): Promise<ProjectListSnapshot>
  getProject(projectId: string): Promise<ProjectEntry>
}

type ProjectConfigFile = {
  projects: ProjectEntry[]
}

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeProjectId(value: unknown): string {
  const projectId = typeof value === "string" ? value.trim() : ""

  if (!projectId) {
    throw new Error("Project ID cannot be empty")
  }

  if (projectId.length > 128) {
    throw new Error("Project ID is too long")
  }

  return projectId
}

function normalizeProjectName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : ""

  if (!name) {
    throw new Error("Project name cannot be empty")
  }

  if (name.length > 120) {
    throw new Error("Project name is too long")
  }

  return name
}

function normalizePathForStorage(pathValue: unknown, platform: NodeJS.Platform): string {
  if (typeof pathValue !== "string") {
    throw new Error("Project path must be a string")
  }

  const trimmed = pathValue.trim()

  if (!trimmed) {
    throw new Error("Project path cannot be empty")
  }

  const pathModule = getPathModule(platform)
  let normalized = pathModule.normalize(trimmed)

  if (!pathModule.isAbsolute(normalized)) {
    throw new Error("Project path must be an absolute directory")
  }

  const parsed = pathModule.parse(normalized)
  while (normalized.length > parsed.root.length && normalized.endsWith(pathModule.sep)) {
    normalized = normalized.slice(0, -1)
  }

  return normalized
}

function createNameDedupeKey(name: string): string {
  return name.toLocaleLowerCase()
}

function createPathDedupeKey(pathValue: string, platform: NodeJS.Platform): string {
  const normalized = getPathModule(platform).normalize(pathValue)

  return platform === "win32" ? normalized.toLocaleLowerCase() : normalized
}

function normalizeEntry(value: unknown, platform: NodeJS.Platform): ProjectEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const id = typeof value.id === "string" ? value.id.trim() : ""
  const name = typeof value.name === "string" ? value.name.trim() : ""
  const path = typeof value.path === "string" ? value.path.trim() : ""
  const addedAt = typeof value.addedAt === "string" ? value.addedAt.trim() : ""
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt.trim() : ""

  if (!id || !name || !path || !addedAt || !updatedAt) {
    return null
  }

  try {
    return {
      id,
      name,
      path: normalizePathForStorage(path, platform),
      addedAt,
      updatedAt
    }
  } catch {
    return null
  }
}

function sanitizeConfig(value: unknown, platform: NodeJS.Platform): ProjectConfigFile {
  if (!isRecord(value) || !Array.isArray(value.projects)) {
    return { projects: [] }
  }

  const projects: ProjectEntry[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const seenPaths = new Set<string>()

  for (const candidate of value.projects) {
    const entry = normalizeEntry(candidate, platform)

    if (!entry) {
      continue
    }

    const nameKey = createNameDedupeKey(entry.name)
    const pathKey = createPathDedupeKey(entry.path, platform)

    if (seenIds.has(entry.id) || seenNames.has(nameKey) || seenPaths.has(pathKey)) {
      continue
    }

    seenIds.add(entry.id)
    seenNames.add(nameKey)
    seenPaths.add(pathKey)
    projects.push(entry)
  }

  return {
    projects
  }
}

async function writeConfig(filePath: string, value: ProjectConfigFile): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export function createProjectConfigStore(
  filePath: string,
  options: ProjectConfigStoreOptions = {}
): ProjectConfigStore {
  const idFactory = options.idFactory ?? randomUUID
  const now = options.now ?? (() => new Date())
  const platform = options.platform ?? process.platform

  async function readConfig(): Promise<ProjectConfigFile> {
    try {
      const raw = await readFile(filePath, "utf8")
      return sanitizeConfig(JSON.parse(raw) as unknown, platform)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if (code === "ENOENT" || error instanceof SyntaxError) {
        return { projects: [] }
      }

      throw error
    }
  }

  function createSnapshot(projects: ProjectEntry[]): ProjectListSnapshot {
    return {
      checkedAt: now().toISOString(),
      projects
    }
  }

  async function validateProjectDirectory(pathValue: string): Promise<void> {
    let stats: Awaited<ReturnType<typeof stat>>

    try {
      stats = await stat(pathValue)
    } catch {
      throw new Error("Project path must be an existing absolute directory")
    }

    if (!stats.isDirectory()) {
      throw new Error("Project path must be an existing absolute directory")
    }
  }

  async function writeProjects(projects: ProjectEntry[]): Promise<ProjectListSnapshot> {
    await writeConfig(filePath, { projects })
    return createSnapshot(projects)
  }

  return {
    async listProjects(): Promise<ProjectListSnapshot> {
      return createSnapshot((await readConfig()).projects)
    },
    async addProject(payload: ProjectAddPayload): Promise<ProjectListSnapshot> {
      const current = (await readConfig()).projects
      const name = normalizeProjectName(payload.name)
      const path = normalizePathForStorage(payload.path, platform)
      const nameKey = createNameDedupeKey(name)
      const pathKey = createPathDedupeKey(path, platform)

      if (current.some((project) => createNameDedupeKey(project.name) === nameKey)) {
        throw new Error(`Project name already exists: ${name}`)
      }

      if (current.some((project) => createPathDedupeKey(project.path, platform) === pathKey)) {
        throw new Error(`Project path is already registered: ${path}`)
      }

      await validateProjectDirectory(path)

      const timestamp = now().toISOString()
      return writeProjects([
        ...current,
        {
          id: idFactory(),
          name,
          path,
          addedAt: timestamp,
          updatedAt: timestamp
        }
      ])
    },
    async renameProject(payload: ProjectRenamePayload): Promise<ProjectListSnapshot> {
      const projectId = normalizeProjectId(payload.projectId)
      const name = normalizeProjectName(payload.name)
      const current = (await readConfig()).projects
      const projectIndex = current.findIndex((project) => project.id === projectId)

      if (projectIndex < 0) {
        throw new Error(`Unknown project: ${projectId}`)
      }

      const nameKey = createNameDedupeKey(name)

      if (
        current.some(
          (project) => project.id !== projectId && createNameDedupeKey(project.name) === nameKey
        )
      ) {
        throw new Error(`Project name already exists: ${name}`)
      }

      const next = [...current]
      next[projectIndex] = {
        ...next[projectIndex],
        name,
        updatedAt: now().toISOString()
      }

      return writeProjects(next)
    },
    async removeProject(payload: ProjectRemovePayload): Promise<ProjectListSnapshot> {
      const projectId = normalizeProjectId(payload.projectId)
      const current = (await readConfig()).projects
      const next = current.filter((project) => project.id !== projectId)

      if (next.length === current.length) {
        throw new Error(`Unknown project: ${projectId}`)
      }

      return writeProjects(next)
    },
    async getProject(projectIdValue: string): Promise<ProjectEntry> {
      const projectId = normalizeProjectId(projectIdValue)
      const project = (await readConfig()).projects.find((item) => item.id === projectId)

      if (!project) {
        throw new Error(`Unknown project: ${projectId}`)
      }

      return project
    }
  }
}
