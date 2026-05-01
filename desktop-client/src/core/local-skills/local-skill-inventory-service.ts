import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { basename, join, normalize, posix, win32 } from "node:path"

import type {
  AgentDetectionSnapshot,
  AgentId,
  LocalSkillInventoryRow,
  LocalSkillServerLookupStatus,
  LocalSkillServerState,
  LocalSkillsInventorySnapshot,
  LocalSkillValidationState,
  RemoteSkillSummary
} from "@/types"

export interface LocalSkillInventoryRefreshInput {
  detectionSnapshot: AgentDetectionSnapshot
  remoteSkills: RemoteSkillSummary[]
  serverLookupStatus: LocalSkillServerLookupStatus
  serverLookupMessage: string | null
}

export interface LocalSkillInventoryServiceDependencies {
  now?: () => Date
  platform?: NodeJS.Platform
  readDirectory?: (path: string, options: { withFileTypes: true }) => Promise<DirectoryEntry[]>
  readTextFile?: (path: string, encoding: BufferEncoding) => Promise<string | Buffer>
}

export interface LocalSkillInventoryService {
  refresh(input: LocalSkillInventoryRefreshInput): Promise<LocalSkillsInventorySnapshot>
}

type ParsedSkillMetadata = {
  name: string | null
  version: string | null
}

type LocalCandidate = {
  packageRootPath: string
  sourceAgents: AgentId[]
}

type DirectoryEntry = {
  name: string
  isDirectory(): boolean
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

function parseSkillFrontmatter(markdown: string): ParsedSkillMetadata {
  const normalized = markdown.replace(/\r\n/g, "\n")

  if (!normalized.startsWith("---\n")) {
    return {
      name: null,
      version: null
    }
  }

  const endIndex = normalized.indexOf("\n---", 4)

  if (endIndex < 0) {
    return {
      name: null,
      version: null
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
    version: fields.get("version") ?? null
  }
}

export function validateLocalSkillName(value: string | null): string {
  const name = value?.trim() ?? ""

  if (!name) {
    throw new Error("SKILL.md frontmatter is missing a usable name")
  }

  if (
    name.length > 100 ||
    name === "." ||
    name === ".." ||
    name.startsWith(".") ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..")
  ) {
    throw new Error(`Invalid SKILL name: ${name}`)
  }

  return name
}

function createPathDedupeKey(pathValue: string, platform: NodeJS.Platform): string {
  const pathModule = platform === "win32" ? win32 : posix
  const normalized = pathModule.normalize(pathValue)

  return platform === "win32" ? normalized.toLowerCase() : normalized
}

function createRowKey(packageRootPath: string, name: string | null, platform: NodeJS.Platform): string {
  return createHash("sha256")
    .update(`${createPathDedupeKey(packageRootPath, platform)}\0${name ?? ""}`)
    .digest("hex")
    .slice(0, 24)
}

function createAgentDisplayNameLookup(snapshot: AgentDetectionSnapshot): Map<AgentId, string> {
  return new Map(snapshot.agentStatuses.map((status) => [status.agentId, status.displayName]))
}

function createRemoteSkillLookup(remoteSkills: RemoteSkillSummary[]): Map<string, RemoteSkillSummary> {
  return new Map(remoteSkills.map((skill) => [skill.name, skill]))
}

function createValidationMessage(validationState: LocalSkillValidationState, error?: unknown): string | null {
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
    case "unreadable":
      return "Local skill directory could not be read."
    case "not-directory":
      return "Local skill candidate is not a directory."
  }
}

function createServerState(args: {
  validationState: LocalSkillValidationState
  name: string | null
  remoteSkill: RemoteSkillSummary | undefined
  serverLookupStatus: LocalSkillServerLookupStatus
}): LocalSkillServerState {
  if (args.validationState !== "valid") {
    return "invalid-local"
  }

  if (args.serverLookupStatus !== "ok") {
    return "unknown"
  }

  return args.name && args.remoteSkill ? "existing" : "missing"
}

function sortRows(rows: LocalSkillInventoryRow[]): LocalSkillInventoryRow[] {
  return [...rows].sort((left, right) => {
    const leftLabel = left.name ?? basename(left.packageRootPath)
    const rightLabel = right.name ?? basename(right.packageRootPath)
    const nameComparison = leftLabel.localeCompare(rightLabel)

    return nameComparison === 0
      ? left.packageRootPath.localeCompare(right.packageRootPath)
      : nameComparison
  })
}

export function createLocalSkillInventoryService(
  dependencies: LocalSkillInventoryServiceDependencies = {}
): LocalSkillInventoryService {
  const now = dependencies.now ?? (() => new Date())
  const platform = dependencies.platform ?? process.platform
  const readDirectory =
    dependencies.readDirectory ??
    ((path: string, options: { withFileTypes: true }) => readdir(path, options))
  const readTextFile =
    dependencies.readTextFile ??
    ((path: string, encoding: BufferEncoding) => readFile(path, encoding))

  async function discoverCandidates(snapshot: AgentDetectionSnapshot): Promise<LocalCandidate[]> {
    const candidates: LocalCandidate[] = []
    const seen = new Set<string>()

    for (const target of snapshot.uniqueTargets) {
      let entries: DirectoryEntry[]

      try {
        entries = await readDirectory(target.targetPath, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }

        const packageRootPath = normalize(join(target.targetPath, entry.name))
        const dedupeKey = createPathDedupeKey(packageRootPath, platform)

        if (seen.has(dedupeKey)) {
          continue
        }

        seen.add(dedupeKey)
        candidates.push({
          packageRootPath,
          sourceAgents: target.coveredAgentIds
        })
      }
    }

    return candidates
  }

  async function buildRow(args: {
    candidate: LocalCandidate
    displayNamesByAgent: Map<AgentId, string>
    remoteSkillsByName: Map<string, RemoteSkillSummary>
    serverLookupStatus: LocalSkillServerLookupStatus
  }): Promise<LocalSkillInventoryRow> {
    let name: string | null = null
    let localVersion: string | null = null
    let validationState: LocalSkillValidationState = "valid"
    let validationError: unknown = null

    try {
      const skillMarkdown = await readTextFile(join(args.candidate.packageRootPath, "SKILL.md"), "utf8")
      const metadata = parseSkillFrontmatter(String(skillMarkdown))

      name = validateLocalSkillName(metadata.name)
      localVersion = metadata.version
    } catch (error) {
      validationError = error
      validationState =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
          ? "missing-skill-md"
          : error instanceof Error && error.message.startsWith("Invalid SKILL name")
            ? "invalid-skill-name"
            : error instanceof Error && error.message.includes("missing a usable name")
              ? "invalid-skill-name"
              : "unreadable"
    }

    const remoteSkill = name ? args.remoteSkillsByName.get(name) : undefined
    const serverState = createServerState({
      validationState,
      name,
      remoteSkill,
      serverLookupStatus: args.serverLookupStatus
    })

    return {
      rowKey: createRowKey(args.candidate.packageRootPath, name, platform),
      name,
      localVersion,
      packageRootPath: args.candidate.packageRootPath,
      sourceAgents: args.candidate.sourceAgents,
      sourceDisplayNames: args.candidate.sourceAgents.map(
        (agentId) => args.displayNamesByAgent.get(agentId) ?? agentId
      ),
      validationState,
      validationMessage: createValidationMessage(validationState, validationError),
      serverState,
      remoteSkillId: remoteSkill?.id ?? null,
      remoteVersion: remoteSkill?.version ?? null,
      uploadable: validationState === "valid" && serverState === "missing"
    }
  }

  return {
    async refresh(input: LocalSkillInventoryRefreshInput): Promise<LocalSkillsInventorySnapshot> {
      const displayNamesByAgent = createAgentDisplayNameLookup(input.detectionSnapshot)
      const remoteSkillsByName = createRemoteSkillLookup(input.remoteSkills)
      const candidates = await discoverCandidates(input.detectionSnapshot)
      const rows = await Promise.all(
        candidates.map((candidate) =>
          buildRow({
            candidate,
            displayNamesByAgent,
            remoteSkillsByName,
            serverLookupStatus: input.serverLookupStatus
          })
        )
      )

      return {
        checkedAt: now().toISOString(),
        rows: sortRows(rows),
        serverLookupStatus: input.serverLookupStatus,
        serverLookupMessage: input.serverLookupMessage
      }
    }
  }
}
