import { createDecipheriv, hkdfSync } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import type { DownloadedSkillArtifact, SkillPackageRequest } from "@/types"

const HKDF_SALT = Buffer.from("open-skillhub:key-derivation:v1", "utf8")
const DOWNLOAD_ENCRYPTION_PURPOSE = "skill-download-encryption"
const DOWNLOAD_DECRYPTION_SECRET_ENV = "OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET"
const AES_GCM_NONCE_LENGTH_BYTES = 12
const AES_GCM_TAG_LENGTH_BYTES = 16

type DecryptArtifact = (
  artifact: DownloadedSkillArtifact,
  request: SkillPackageRequest
) => Promise<DownloadedSkillArtifact>

function normalizeSecret(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function sanitizeArtifactSegment(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "_")
  return normalized && normalized !== "." && normalized !== ".." ? normalized : "package"
}

function createDecryptedArtifactFileName(request: SkillPackageRequest): string {
  return `${sanitizeArtifactSegment(request.skillId)}-${sanitizeArtifactSegment(
    request.version ?? "latest"
  )}.decrypted.zip`
}

export function getDownloadDecryptionSecret(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  return normalizeSecret(env[DOWNLOAD_DECRYPTION_SECRET_ENV])
}

export function deriveAes256Key(
  secret: string,
  purpose = DOWNLOAD_ENCRYPTION_PURPOSE
): Buffer {
  const normalizedSecret = normalizeSecret(secret)

  if (!normalizedSecret) {
    throw new Error("Download decryption secret cannot be empty")
  }

  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(normalizedSecret, "utf8"),
      HKDF_SALT,
      Buffer.from(purpose, "utf8"),
      32
    )
  )
}

export function decryptPayload(encryptedPayload: Buffer, secret: string): Buffer {
  if (encryptedPayload.length <= AES_GCM_NONCE_LENGTH_BYTES + AES_GCM_TAG_LENGTH_BYTES) {
    throw new Error("Encrypted skill package payload is too short")
  }

  const key = deriveAes256Key(secret)
  const nonce = encryptedPayload.subarray(0, AES_GCM_NONCE_LENGTH_BYTES)
  const encryptedBody = encryptedPayload.subarray(AES_GCM_NONCE_LENGTH_BYTES)
  const ciphertext = encryptedBody.subarray(0, encryptedBody.length - AES_GCM_TAG_LENGTH_BYTES)
  const tag = encryptedBody.subarray(encryptedBody.length - AES_GCM_TAG_LENGTH_BYTES)

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    throw new Error("Failed to decrypt skill package")
  }
}

export function createDecryptArtifactFromEnv(
  env: NodeJS.ProcessEnv = process.env
): DecryptArtifact {
  return async (artifact, request) => {
    const secret = getDownloadDecryptionSecret(env)

    if (!secret) {
      throw new Error(
        `${DOWNLOAD_DECRYPTION_SECRET_ENV} is required to decrypt encrypted skill packages`
      )
    }

    const encryptedPayload = await readFile(artifact.artifactPath)
    const decryptedPayload = decryptPayload(encryptedPayload, secret)
    const decryptedArtifactPath = join(dirname(artifact.artifactPath), createDecryptedArtifactFileName(request))

    await writeFile(decryptedArtifactPath, decryptedPayload)

    return {
      artifactPath: decryptedArtifactPath,
      encrypted: false,
      cleanupPaths: artifact.cleanupPaths
    }
  }
}
