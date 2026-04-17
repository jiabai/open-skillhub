import { mkdir, readdir, stat, copyFile } from "node:fs/promises"
import { isAbsolute, join, normalize, relative } from "node:path"

export type AgentId = "codex" | "claude-code" | "gemini-cli"

export interface ExtractedSkillPayloadV1 {
  skillId: string
  version?: string | null
  extractedPath: string
}

export interface AgentInstallContextV1 {
  skillsPath: string
}

export interface InstalledSkillV1 {
  skillDir: string
  filePaths: string[]
}

export interface AgentAdapterV1 {
  id: AgentId
  displayName: string
  installSkill(payload: ExtractedSkillPayloadV1, context: AgentInstallContextV1): Promise<InstalledSkillV1>
  verifyInstalledSkill(payload: ExtractedSkillPayloadV1, installed: InstalledSkillV1): Promise<boolean>
}

export interface AgentAdapterDefinition {
  id: AgentId
  displayName: string
}

function createSkillDirectoryName(payload: ExtractedSkillPayloadV1): string {
  const skillId = payload.skillId.trim()

  if (!skillId || skillId === "." || skillId === ".." || skillId.includes("/") || skillId.includes("\\")) {
    throw new Error(`Invalid skill identifier: ${payload.skillId}`)
  }

  return skillId
}

async function ensureDirectoryContents(path: string): Promise<boolean> {
  const entries = await readdir(path)

  return entries.length > 0
}

async function collectRelativeFiles(rootPath: string, currentPath = rootPath): Promise<string[]> {
  const entries = await readdir(currentPath, { withFileTypes: true })
  const collected: string[] = []

  for (const entry of entries) {
    const nextPath = join(currentPath, entry.name)

    if (entry.isDirectory()) {
      collected.push(...(await collectRelativeFiles(rootPath, nextPath)))
      continue
    }

    if (entry.isFile()) {
      collected.push(relative(rootPath, nextPath).replace(/\\/g, "/"))
    }
  }

  return collected
}

async function copyDirectoryContents(sourcePath: string, targetPath: string): Promise<void> {
  const entries = await readdir(sourcePath, { withFileTypes: true })

  for (const entry of entries) {
    const sourceEntryPath = join(sourcePath, entry.name)
    const targetEntryPath = join(targetPath, entry.name)

    if (entry.isDirectory()) {
      await mkdir(targetEntryPath, { recursive: true })
      await copyDirectoryContents(sourceEntryPath, targetEntryPath)
      continue
    }

    if (entry.isFile()) {
      await copyFile(sourceEntryPath, targetEntryPath)
    }
  }
}

export function createFilesystemAgentAdapter(definition: AgentAdapterDefinition): AgentAdapterV1 {
  return {
    id: definition.id,
    displayName: definition.displayName,
    async installSkill(
      payload: ExtractedSkillPayloadV1,
      context: AgentInstallContextV1
    ): Promise<InstalledSkillV1> {
      const sourcePath = normalize(payload.extractedPath)
      const targetPath = join(context.skillsPath, createSkillDirectoryName(payload))

      if (!sourcePath || sourcePath === "." || !isAbsolute(sourcePath)) {
        throw new Error(`Invalid extracted skill path: ${payload.extractedPath}`)
      }

      await mkdir(context.skillsPath, { recursive: true })
      await mkdir(targetPath, { recursive: true })
      await copyDirectoryContents(sourcePath, targetPath)

      const filePaths = await collectRelativeFiles(targetPath)

      return {
        skillDir: targetPath,
        filePaths
      }
    },
    async verifyInstalledSkill(
      payload: ExtractedSkillPayloadV1,
      installed: InstalledSkillV1
    ): Promise<boolean> {
      try {
        const installedStat = await stat(installed.skillDir)

        if (!installedStat.isDirectory()) {
          return false
        }

        const sourceStat = await stat(payload.extractedPath)

        if (!sourceStat.isDirectory()) {
          return false
        }

        const sourceFiles = await collectRelativeFiles(payload.extractedPath)

        if (sourceFiles.length === 0) {
          return false
        }

        for (const relativeFilePath of sourceFiles) {
          const fileStat = await stat(join(installed.skillDir, relativeFilePath))

          if (!fileStat.isFile()) {
            return false
          }
        }

        return await ensureDirectoryContents(installed.skillDir)
      } catch {
        return false
      }
    }
  }
}

export async function skillDirectoryExists(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path)

    return fileStat.isDirectory()
  } catch {
    return false
  }
}
