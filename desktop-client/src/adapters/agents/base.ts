import { createHash } from "node:crypto"
import { mkdir, readdir, stat, copyFile, readFile } from "node:fs/promises"
import { isAbsolute, join, normalize, relative } from "node:path"

import {
  createSafeSkillDirectoryName,
  findInstalledSkillDirectory,
  resolveSkillInstallPath
} from "@/adapters/agents/skill-layout"
import type {
  AgentSkillLayout,
  AgentId,
  InstalledSkillMetadataV1,
  InstalledSkillVersionSource
} from "@/types"

export interface ExtractedSkillPayloadV1 {
  skillId: string
  name: string
  version?: string | null
  extractedPath: string
}

export interface AgentInstallContextV1 {
  skillsPath: string
  skillLayout?: AgentSkillLayout
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
  readInstalledSkillMetadata(skillName: string, context: AgentInstallContextV1): Promise<InstalledSkillMetadataV1>
}

export interface AgentAdapterDefinition {
  id: AgentId
  displayName: string
}

function createSkillDirectoryName(payload: ExtractedSkillPayloadV1): string {
  return createSafeSkillDirectoryName(payload.name)
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"
}

function cleanMetadataVersion(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function unquoteYamlValue(value: string): string {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

function readFrontmatterVersion(markdown: string): string | null {
  const normalized = markdown.replace(/\r\n/g, "\n")

  if (!normalized.startsWith("---\n")) {
    return null
  }

  const endIndex = normalized.indexOf("\n---", 4)

  if (endIndex < 0) {
    return null
  }

  const frontmatter = normalized.slice(4, endIndex)

  for (const line of frontmatter.split("\n")) {
    const separatorIndex = line.indexOf(":")

    if (separatorIndex < 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()

    if (key !== "version") {
      continue
    }

    return cleanMetadataVersion(unquoteYamlValue(line.slice(separatorIndex + 1)))
  }

  return null
}

async function readSkillFrontmatterVersion(skillDir: string): Promise<string | null> {
  try {
    return readFrontmatterVersion(await readFile(join(skillDir, "SKILL.md"), "utf8"))
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }

    throw error
  }
}

async function readManifestVersion(manifestPath: string): Promise<string | null> {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>

    return cleanMetadataVersion(parsed.version)
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return null
    }

    throw error
  }
}

async function readInstalledMetadataVersion(
  skillDir: string
): Promise<{ version: string | null; versionSource: InstalledSkillVersionSource }> {
  const readers: Array<{
    versionSource: Exclude<InstalledSkillVersionSource, null>
    read(): Promise<string | null>
  }> = [
    {
      versionSource: "skill-frontmatter",
      read: () => readSkillFrontmatterVersion(skillDir)
    },
    {
      versionSource: "manifest-json",
      read: () => readManifestVersion(join(skillDir, "manifest.json"))
    },
    {
      versionSource: "nested-manifest-json",
      read: () => readManifestVersion(join(skillDir, "skills", "manifest.json"))
    }
  ]

  for (const reader of readers) {
    const version = await reader.read()

    if (version !== null) {
      return {
        version,
        versionSource: reader.versionSource
      }
    }
  }

  return {
    version: null,
    versionSource: null
  }
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

function shouldSkipContentHashFile(relativeFilePath: string): boolean {
  const parts = relativeFilePath.split("/")
  const fileName = parts.at(-1)

  return fileName === ".DS_Store" || fileName === "Thumbs.db" || parts.includes("__MACOSX")
}

export async function computeSkillContentHash(rootPath: string): Promise<string> {
  const relativeFilePaths = (await collectRelativeFiles(rootPath))
    .filter((relativeFilePath) => !shouldSkipContentHashFile(relativeFilePath))
    .sort()
  const hasher = createHash("sha256")

  for (const relativeFilePath of relativeFilePaths) {
    hasher.update(`${relativeFilePath}\0`)
    hasher.update(await readFile(join(rootPath, relativeFilePath)))
    hasher.update("\0")
  }

  return hasher.digest("hex")
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
      const targetPath = resolveSkillInstallPath(
        context.skillsPath,
        createSkillDirectoryName(payload),
        context.skillLayout
      )

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
    },
    async readInstalledSkillMetadata(
      skillName: string,
      context: AgentInstallContextV1
    ): Promise<InstalledSkillMetadataV1> {
      const safeSkillName = createSafeSkillDirectoryName(skillName)
      const lookup = await findInstalledSkillDirectory(
        context.skillsPath,
        safeSkillName,
        context.skillLayout
      )

      if (lookup.status === "ambiguous") {
        throw new Error(
          `Multiple categorized skill directories found for ${safeSkillName}: ${lookup.skillDirs.join(", ")}`
        )
      }

      const skillDir = lookup.skillDir

      try {
        const skillDirStat = await stat(skillDir)

        if (!skillDirStat.isDirectory()) {
          throw new Error(`Installed skill path is not a directory: ${skillDir}`)
        }

        const metadata = await readInstalledMetadataVersion(skillDir)

        return {
          exists: true,
          skillDir,
          version: metadata.version,
          versionSource: metadata.versionSource,
          contentHash: await computeSkillContentHash(skillDir)
        }
      } catch (error) {
        if (isMissingFileError(error)) {
          return {
            exists: false,
            skillDir,
            version: null,
            versionSource: null,
            contentHash: null
          }
        }

        throw error
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
