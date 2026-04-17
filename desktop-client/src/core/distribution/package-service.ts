import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises"
import { join } from "node:path"
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
  return mkdtemp(join(tmpdir(), "open-skillhub-package-"))
}

async function defaultRemovePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
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

      const downloadedArtifact = await dependencies.downloadArtifact(validatedRequest)
      await validateArtifactPath(downloadedArtifact.artifactPath)

      let currentArtifact = downloadedArtifact

      if (currentArtifact.encrypted) {
        if (!dependencies.decryptArtifact) {
          throw new Error(
            "Encrypted skill packages require a decryptArtifact dependency before distribution"
          )
        }

        currentArtifact = await dependencies.decryptArtifact(currentArtifact, validatedRequest)
        await validateArtifactPath(currentArtifact.artifactPath)
      }

      const tempRoot = await createTempDirectory()
      const extractedPath = join(tempRoot, "extracted")

      try {
        await mkdir(extractedPath, { recursive: true })
        await dependencies.extractArtifact(currentArtifact, extractedPath, validatedRequest)

        if (dependencies.validateExtractedArtifact) {
          await dependencies.validateExtractedArtifact(extractedPath, validatedRequest)
        } else {
          await validateExtractedDirectory(extractedPath)
        }
      } catch (error) {
        await removePath(tempRoot)
        throw error
      }

      return {
        skillId,
        name,
        version,
        extractedPath,
        async cleanup(): Promise<void> {
          await removePath(tempRoot)
        }
      }
    }
  }
}
