import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises"
import { isAbsolute, join, parse, relative, resolve } from "node:path"
import { tmpdir } from "node:os"

import type {
  DownloadedSkillArtifact,
  PreparedSkillPackage,
  SkillPackageRequest
} from "@/types"

export interface PackageServiceDependencies {
  downloadArtifact(request: SkillPackageRequest): Promise<DownloadedSkillArtifact>
  decryptArtifact?(
    artifact: DownloadedSkillArtifact,
    request: SkillPackageRequest
  ): Promise<DownloadedSkillArtifact>
  extractArtifact(
    artifact: DownloadedSkillArtifact,
    extractedPath: string,
    request: SkillPackageRequest
  ): Promise<void>
  validateExtractedArtifact?(
    extractedPath: string,
    request: SkillPackageRequest
  ): Promise<void>
  createTempDirectory?(): Promise<string>
  removePath?(path: string): Promise<void>
  warn?(message: string, error: unknown): void
}

export interface PackageService {
  validateAndExtract(request: SkillPackageRequest): Promise<PreparedSkillPackage>
}

function normalizeField(value: string, fieldName: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`Skill package ${fieldName} cannot be empty`)
  }

  return normalized
}

async function defaultCreateTempDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "skilldrive-package-"))
}

async function defaultRemovePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
}

type CleanupTarget = {
  path: string
  label: "download-artifact" | "decrypted-artifact" | "extraction-root"
}

function defaultWarn(message: string, error: unknown): void {
  console.warn(message, error)
}

function normalizeCleanupPath(pathValue: string): string {
  const trimmed = pathValue.trim()

  if (!trimmed) {
    throw new Error("Cleanup path cannot be empty")
  }

  if (!isAbsolute(trimmed)) {
    throw new Error(`Cleanup path must be absolute: ${pathValue}`)
  }

  const normalized = resolve(trimmed)

  if (normalized === parse(normalized).root) {
    throw new Error(`Cleanup path cannot be a filesystem root: ${pathValue}`)
  }

  return normalized
}

function isSameOrInsidePath(pathValue: string, parentPath: string): boolean {
  const normalizedPath = resolve(pathValue)
  const normalizedParent = resolve(parentPath)
  const relativePath = relative(normalizedParent, normalizedPath)

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  )
}

function createCleanupTracker(options: {
  removePath(path: string): Promise<void>
  warn(message: string, error: unknown): void
}) {
  const targets: CleanupTarget[] = []
  const seen = new Set<string>()

  function add(path: string, label: CleanupTarget["label"]): void {
    const normalized = normalizeCleanupPath(path)

    if (seen.has(normalized)) {
      return
    }

    seen.add(normalized)
    targets.push({ path: normalized, label })
  }

  function addMany(paths: string[] | undefined, label: CleanupTarget["label"]): void {
    for (const path of paths ?? []) {
      add(path, label)
    }
  }

  function ownsPath(path: string): boolean {
    const normalized = normalizeCleanupPath(path)

    return targets.some((target) => isSameOrInsidePath(normalized, target.path))
  }

  async function cleanupAll(): Promise<void> {
    for (const target of [...targets].reverse()) {
      try {
        await options.removePath(target.path)
      } catch (error) {
        options.warn(`Failed to clean up ${target.label}: ${target.path}`, error)
      }
    }
  }

  return { add, addMany, cleanupAll, ownsPath }
}

async function validateArtifactPath(artifactPath: string): Promise<void> {
  const artifactStat = await stat(artifactPath)

  if (!artifactStat.isFile() && !artifactStat.isDirectory()) {
    throw new Error(`Skill package artifact is not a file or directory: ${artifactPath}`)
  }
}

async function validateExtractedDirectory(extractedPath: string): Promise<void> {
  const extractedStat = await stat(extractedPath)

  if (!extractedStat.isDirectory()) {
    throw new Error(`Skill package extracted path is not a directory: ${extractedPath}`)
  }

  const entries = await readdir(extractedPath)

  if (entries.length === 0) {
    throw new Error(`Skill package extracted path is empty: ${extractedPath}`)
  }
}

export function createPackageService(
  dependencies: PackageServiceDependencies
): PackageService {
  const createTempDirectory = dependencies.createTempDirectory ?? defaultCreateTempDirectory
  const removePath = dependencies.removePath ?? defaultRemovePath
  const warn = dependencies.warn ?? defaultWarn

  return {
    async validateAndExtract(request: SkillPackageRequest): Promise<PreparedSkillPackage> {
      const skillId = normalizeField(request.skillId, "skillId")
      const name = normalizeField(request.name, "name")
      const version = request.version?.trim() || null
      const validatedRequest: SkillPackageRequest = {
        ...request,
        skillId,
        name,
        version
      }

      const cleanupTracker = createCleanupTracker({ removePath, warn })
      const downloadedArtifact = await dependencies.downloadArtifact(validatedRequest)

      try {
        cleanupTracker.addMany(downloadedArtifact.cleanupPaths, "download-artifact")
        await validateArtifactPath(downloadedArtifact.artifactPath)

        let currentArtifact = downloadedArtifact

        if (currentArtifact.encrypted) {
          if (!dependencies.decryptArtifact) {
            throw new Error(
              "Encrypted skill packages require a decryptArtifact dependency before distribution"
            )
          }

          currentArtifact = await dependencies.decryptArtifact(currentArtifact, validatedRequest)
          cleanupTracker.addMany(currentArtifact.cleanupPaths, "decrypted-artifact")

          if (currentArtifact.encrypted) {
            throw new Error("decryptArtifact returned an encrypted artifact")
          }

          await validateArtifactPath(currentArtifact.artifactPath)

          if (!cleanupTracker.ownsPath(currentArtifact.artifactPath)) {
            throw new Error(
              `Decrypted skill artifact cleanup ownership is ambiguous: ${currentArtifact.artifactPath}`
            )
          }
        }

        const tempRoot = await createTempDirectory()
        cleanupTracker.add(tempRoot, "extraction-root")
        const extractedPath = join(tempRoot, "extracted")

        await mkdir(extractedPath, { recursive: true })
        await dependencies.extractArtifact(currentArtifact, extractedPath, validatedRequest)

        if (dependencies.validateExtractedArtifact) {
          await dependencies.validateExtractedArtifact(extractedPath, validatedRequest)
        } else {
          await validateExtractedDirectory(extractedPath)
        }

        return {
          skillId,
          name,
          version,
          extractedPath,
          async cleanup(): Promise<void> {
            await cleanupTracker.cleanupAll()
          }
        }
      } catch (error) {
        await cleanupTracker.cleanupAll()
        throw error
      }
    }
  }
}
