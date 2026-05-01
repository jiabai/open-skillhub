import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  createDecryptArtifactFromEnv,
  decryptPayload,
  deriveAes256Key
} from "../../electron/encryption"

describe("encrypted package decryptor", () => {
  const tempRoots: string[] = []
  const secret = "test-download-secret"
  const plaintext = Buffer.from("hello open skillhub zip bytes", "utf8")
  const encryptedFixture = Buffer.from(
    "AAECAwQFBgcICQoLYOhC3QxmrPcms6dQ96z7c19K6+boVHdQKQZ6KuNm51T4LCQr6dKAUnCk/OH5",
    "base64"
  )

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createTempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "open-skillhub-encryption-"))
    tempRoots.push(root)
    return root
  }

  it("derives the same AES-256 key as the backend HKDF contract", () => {
    expect(deriveAes256Key(secret).toString("hex")).toBe(
      "0cbe4baa904430d3f6e5df37aeb20d173c39d2b60ca9fc266775eeae7bbc5841"
    )
  })

  it("decrypts backend-compatible AES-GCM payloads", () => {
    expect(decryptPayload(encryptedFixture, secret)).toEqual(plaintext)
  })

  it("writes decrypted artifacts inside the owned staging directory", async () => {
    const artifactRoot = createTempRoot()
    const encryptedPath = join(artifactRoot, "downloaded-package.encrypted.bin")
    writeFileSync(encryptedPath, encryptedFixture)

    const decryptArtifact = createDecryptArtifactFromEnv({
      OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET: secret
    })
    const result = await decryptArtifact(
      {
        artifactPath: encryptedPath,
        encrypted: true,
        cleanupPaths: [artifactRoot]
      },
      {
        skillId: "skill-a",
        name: "Skill A",
        version: "1.0.0",
        packageSource: { source: "test" }
      }
    )

    expect(result.encrypted).toBe(false)
    expect(result.cleanupPaths).toEqual([artifactRoot])
    expect(result.artifactPath).toBe(join(artifactRoot, "skill-a-1.0.0.decrypted.zip"))
    expect(readFileSync(result.artifactPath)).toEqual(plaintext)
  })

  it("fails closed when the runtime decryption secret is missing", async () => {
    const artifactRoot = createTempRoot()
    const encryptedPath = join(artifactRoot, "downloaded-package.encrypted.bin")
    writeFileSync(encryptedPath, encryptedFixture)

    const decryptArtifact = createDecryptArtifactFromEnv({})

    await expect(
      decryptArtifact(
        {
          artifactPath: encryptedPath,
          encrypted: true,
          cleanupPaths: [artifactRoot]
        },
        {
          skillId: "skill-a",
          name: "Skill A",
          version: "1.0.0",
          packageSource: { source: "test" }
        }
      )
    ).rejects.toThrow("OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET is required")
    expect(existsSync(encryptedPath)).toBe(true)
  })

  it("fails closed when authentication fails", () => {
    expect(() => decryptPayload(encryptedFixture, "wrong-secret")).toThrow(
      "Failed to decrypt skill package"
    )
  })
})
