import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createPackageService } from "@/core/distribution/package-service"
import type { DownloadedSkillArtifact, SkillPackageRequest } from "@/types"

describe("package service artifact cleanup", () => {
  const tempRoots: string[] = []
  const request: SkillPackageRequest = {
    skillId: "skill-a",
    name: "Skill A",
    version: "1.0.0",
    packageSource: { source: "test" }
  }

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createTempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "skilldrive-package-service-"))
    tempRoots.push(root)
    return root
  }

  function copyDirectoryContentsSync(sourcePath: string, targetPath: string): void {
    mkdirSync(targetPath, { recursive: true })

    for (const entry of readdirSync(sourcePath, { withFileTypes: true })) {
      const sourceEntryPath = join(sourcePath, entry.name)
      const targetEntryPath = join(targetPath, entry.name)

      if (entry.isDirectory()) {
        copyDirectoryContentsSync(sourceEntryPath, targetEntryPath)
        continue
      }

      if (entry.isFile()) {
        copyFileSync(sourceEntryPath, targetEntryPath)
      }
    }
  }

  function createPackageDirectory(parentPath: string, name = "package-source"): string {
    const packagePath = join(parentPath, name)
    mkdirSync(packagePath, { recursive: true })
    writeFileSync(join(packagePath, "README.md"), "# Skill")
    writeFileSync(join(packagePath, "SKILL.md"), "---\nversion: 1.0.0\n---\n# Skill")
    return packagePath
  }

  function createExtractArtifact(failWith?: Error) {
    return vi.fn(async (artifact: DownloadedSkillArtifact, extractedPath: string) => {
      if (failWith) {
        throw failWith
      }

      copyDirectoryContentsSync(artifact.artifactPath, extractedPath)
    })
  }

  function createValidation(failWith?: Error) {
    return vi.fn(async () => {
      if (failWith) {
        throw failWith
      }
    })
  }

  it("cleans declared download staging and extraction roots", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const artifactPath = createPackageDirectory(artifactRoot)
    const tempRoot = join(root, "extract-temp")
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath,
        encrypted: false,
        cleanupPaths: [artifactRoot]
      }),
      extractArtifact: createExtractArtifact(),
      createTempDirectory: async () => tempRoot
    })

    const prepared = await service.validateAndExtract(request)

    expect(existsSync(artifactRoot)).toBe(true)
    expect(existsSync(prepared.extractedPath)).toBe(true)

    await prepared.cleanup()

    expect(existsSync(artifactRoot)).toBe(false)
    expect(existsSync(tempRoot)).toBe(false)
  })

  it("does not delete an external artifact path without cleanup ownership", async () => {
    const root = createTempRoot()
    const artifactPath = createPackageDirectory(root, "external-package")
    const tempRoot = join(root, "extract-temp")
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath,
        encrypted: false
      }),
      extractArtifact: createExtractArtifact(),
      createTempDirectory: async () => tempRoot
    })

    const prepared = await service.validateAndExtract(request)
    await prepared.cleanup()

    expect(existsSync(artifactPath)).toBe(true)
    expect(existsSync(tempRoot)).toBe(false)
  })

  it("cleans declared downloads when encrypted packages lack a decryptor", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const artifactPath = createPackageDirectory(artifactRoot)
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath,
        encrypted: true,
        cleanupPaths: [artifactRoot]
      }),
      extractArtifact: createExtractArtifact()
    })

    await expect(service.validateAndExtract(request)).rejects.toThrow(
      "Encrypted skill packages require a decryptArtifact dependency before distribution"
    )
    expect(existsSync(artifactRoot)).toBe(false)
  })

  it("fails closed and cleans when a decryptor returns an encrypted artifact", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const artifactPath = createPackageDirectory(artifactRoot)
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath,
        encrypted: true,
        cleanupPaths: [artifactRoot]
      }),
      decryptArtifact: async (artifact) => artifact,
      extractArtifact: createExtractArtifact()
    })

    await expect(service.validateAndExtract(request)).rejects.toThrow(
      "decryptArtifact returned an encrypted artifact"
    )
    expect(existsSync(artifactRoot)).toBe(false)
  })

  it("accepts decrypted artifacts inside an already owned staging directory", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const encryptedPath = createPackageDirectory(artifactRoot, "encrypted-package")
    const decryptedPath = createPackageDirectory(artifactRoot, "decrypted-package")
    const tempRoot = join(root, "extract-temp")
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath: encryptedPath,
        encrypted: true,
        cleanupPaths: [artifactRoot]
      }),
      decryptArtifact: async () => ({
        artifactPath: decryptedPath,
        encrypted: false
      }),
      extractArtifact: createExtractArtifact(),
      createTempDirectory: async () => tempRoot
    })

    const prepared = await service.validateAndExtract(request)
    await prepared.cleanup()

    expect(existsSync(artifactRoot)).toBe(false)
    expect(existsSync(tempRoot)).toBe(false)
  })

  it("rejects decrypted artifacts outside owned cleanup roots", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const encryptedPath = createPackageDirectory(artifactRoot, "encrypted-package")
    const externalDecryptedPath = createPackageDirectory(root, "external-decrypted-package")
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath: encryptedPath,
        encrypted: true,
        cleanupPaths: [artifactRoot]
      }),
      decryptArtifact: async () => ({
        artifactPath: externalDecryptedPath,
        encrypted: false
      }),
      extractArtifact: createExtractArtifact()
    })

    await expect(service.validateAndExtract(request)).rejects.toThrow(
      "Decrypted skill artifact cleanup ownership is ambiguous"
    )
    expect(existsSync(artifactRoot)).toBe(false)
    expect(existsSync(externalDecryptedPath)).toBe(true)
  })

  it("accepts decrypted artifacts outside the download root when ownership is declared", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const encryptedPath = createPackageDirectory(artifactRoot, "encrypted-package")
    const decryptedRoot = join(root, "decrypted-staging")
    const decryptedPath = createPackageDirectory(decryptedRoot, "decrypted-package")
    const tempRoot = join(root, "extract-temp")
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath: encryptedPath,
        encrypted: true,
        cleanupPaths: [artifactRoot]
      }),
      decryptArtifact: async () => ({
        artifactPath: decryptedPath,
        encrypted: false,
        cleanupPaths: [decryptedRoot]
      }),
      extractArtifact: createExtractArtifact(),
      createTempDirectory: async () => tempRoot
    })

    const prepared = await service.validateAndExtract(request)
    await prepared.cleanup()

    expect(existsSync(artifactRoot)).toBe(false)
    expect(existsSync(decryptedRoot)).toBe(false)
    expect(existsSync(tempRoot)).toBe(false)
  })

  it("cleans registered targets when extraction or validation fails", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const artifactPath = createPackageDirectory(artifactRoot)
    const tempRoot = join(root, "extract-temp")
    const extractionFailure = new Error("extract failed")
    const extractionService = createPackageService({
      downloadArtifact: async () => ({
        artifactPath,
        encrypted: false,
        cleanupPaths: [artifactRoot]
      }),
      extractArtifact: createExtractArtifact(extractionFailure),
      createTempDirectory: async () => tempRoot
    })

    await expect(extractionService.validateAndExtract(request)).rejects.toThrow("extract failed")
    expect(existsSync(artifactRoot)).toBe(false)
    expect(existsSync(tempRoot)).toBe(false)

    const validationArtifactRoot = join(root, "validation-staging")
    const validationArtifactPath = createPackageDirectory(validationArtifactRoot)
    const validationTempRoot = join(root, "validation-extract-temp")
    const validationService = createPackageService({
      downloadArtifact: async () => ({
        artifactPath: validationArtifactPath,
        encrypted: false,
        cleanupPaths: [validationArtifactRoot]
      }),
      extractArtifact: createExtractArtifact(),
      validateExtractedArtifact: createValidation(new Error("validation failed")),
      createTempDirectory: async () => validationTempRoot
    })

    await expect(validationService.validateAndExtract(request)).rejects.toThrow("validation failed")
    expect(existsSync(validationArtifactRoot)).toBe(false)
    expect(existsSync(validationTempRoot)).toBe(false)
  })

  it("continues cleanup after warnings and rejects invalid cleanup paths", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const artifactPath = createPackageDirectory(artifactRoot)
    const tempRoot = join(root, "extract-temp")
    const removedPaths: string[] = []
    const warn = vi.fn()
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath,
        encrypted: false,
        cleanupPaths: [artifactRoot]
      }),
      extractArtifact: createExtractArtifact(),
      createTempDirectory: async () => tempRoot,
      removePath: async (path) => {
        removedPaths.push(path)

        if (path === tempRoot) {
          throw new Error("temp cleanup failed")
        }

        await rm(path, { recursive: true, force: true })
      },
      warn
    })

    const prepared = await service.validateAndExtract(request)
    await prepared.cleanup()

    expect(removedPaths).toEqual([tempRoot, artifactRoot])
    expect(warn).toHaveBeenCalledWith(
      `Failed to clean up extraction-root: ${tempRoot}`,
      expect.any(Error)
    )
    expect(existsSync(artifactRoot)).toBe(false)

    const invalidRemovePath = vi.fn()
    const invalidService = createPackageService({
      downloadArtifact: async () => ({
        artifactPath,
        encrypted: false,
        cleanupPaths: ["relative-cleanup-path"]
      }),
      extractArtifact: createExtractArtifact(),
      removePath: invalidRemovePath
    })

    await expect(invalidService.validateAndExtract(request)).rejects.toThrow(
      "Cleanup path must be absolute"
    )
    expect(invalidRemovePath).not.toHaveBeenCalled()
  })

  it("deduplicates cleanup paths and allows idempotent cleanup", async () => {
    const root = createTempRoot()
    const artifactRoot = join(root, "download-staging")
    const artifactPath = createPackageDirectory(artifactRoot)
    const tempRoot = join(root, "extract-temp")
    const removedPaths: string[] = []
    const service = createPackageService({
      downloadArtifact: async () => ({
        artifactPath,
        encrypted: false,
        cleanupPaths: [artifactRoot, join(artifactRoot, ".")]
      }),
      extractArtifact: createExtractArtifact(),
      createTempDirectory: async () => tempRoot,
      removePath: async (path) => {
        removedPaths.push(path)
        await rm(path, { recursive: true, force: true })
      }
    })

    const prepared = await service.validateAndExtract(request)

    await prepared.cleanup()
    await prepared.cleanup()

    expect(removedPaths).toEqual([tempRoot, artifactRoot, tempRoot, artifactRoot])
  })
})
