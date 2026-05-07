import type { LocalSkillValidationState } from "@/types"

export interface ProjectSkillMetadata {
  name: string | null
  slug: string | null
  version: string | null
  description: string | null
}

export interface ProjectSkillIdentityResult {
  identity: string | null
  validationState: LocalSkillValidationState
  validationMessage: string | null
}

function normalizeMetadataValue(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null
  }

  return trimmed
}

export function parseProjectSkillFrontmatter(markdown: string): ProjectSkillMetadata {
  const normalized = markdown.replace(/\r\n/g, "\n")

  if (!normalized.startsWith("---\n")) {
    return {
      name: null,
      slug: null,
      version: null,
      description: null
    }
  }

  const endIndex = normalized.indexOf("\n---", 4)

  if (endIndex < 0) {
    return {
      name: null,
      slug: null,
      version: null,
      description: null
    }
  }

  const fields = new Map<string, string>()
  const frontmatter = normalized.slice(4, endIndex)

  for (const line of frontmatter.split("\n")) {
    const separatorIndex = line.indexOf(":")

    if (separatorIndex < 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = normalizeMetadataValue(line.slice(separatorIndex + 1))

    if (value !== null) {
      fields.set(key, value)
    }
  }

  return {
    name: fields.get("name") ?? null,
    slug: fields.get("slug") ?? null,
    version: fields.get("version") ?? null,
    description: fields.get("description") ?? null
  }
}

export function validateProjectSkillIdentity(value: string | null): string {
  const identity = value?.trim() ?? ""

  if (!identity) {
    throw new Error("SKILL.md frontmatter is missing a usable slug or name")
  }

  if (
    identity.length > 100 ||
    identity === "." ||
    identity === ".." ||
    identity.startsWith(".") ||
    identity.includes("/") ||
    identity.includes("\\") ||
    identity.includes("..") ||
    !/^[a-zA-Z0-9_.-]+$/.test(identity)
  ) {
    throw new Error(`Invalid SKILL name: ${identity}`)
  }

  return identity
}

export function resolveProjectSkillIdentity(
  metadata: ProjectSkillMetadata
): ProjectSkillIdentityResult {
  const candidates = [metadata.slug, metadata.name]
  let invalidIdentityError: Error | null = null

  for (const candidate of candidates) {
    if (candidate === null) {
      continue
    }

    try {
      return {
        identity: validateProjectSkillIdentity(candidate),
        validationState: "valid",
        validationMessage: null
      }
    } catch (error) {
      if (invalidIdentityError === null && error instanceof Error) {
        invalidIdentityError = error
      }
    }
  }

  const message =
    invalidIdentityError?.message ?? "SKILL.md frontmatter is missing a usable slug or name"

  return {
    identity: null,
    validationState: "invalid-skill-name",
    validationMessage: message
  }
}

export function createProjectSkillValidationMessage(
  validationState: LocalSkillValidationState,
  error?: unknown
): string | null {
  if (validationState === "valid") {
    return null
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  switch (validationState) {
    case "missing-skill-md":
      return "Root SKILL.md was not found."
    case "invalid-skill-name":
      return "SKILL name is invalid."
    case "not-directory":
      return "Local skill candidate is not a directory."
    case "unreadable":
      return "Local skill directory could not be read."
  }
}
