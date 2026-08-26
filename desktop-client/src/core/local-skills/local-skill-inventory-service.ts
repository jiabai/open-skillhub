import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { basename, join, normalize, posix, win32 } from "node:path"

import { compareStrictSemverVersions, parseStrictSemver } from "@/core/pre-distribution-check/version-compare"
import { enumerateSkillDirectories } from "@/adapters/agents/skill-layout"
import { computeSkillContentHash } from "@/adapters/agents/base"
import type {
  AgentDetectionSnapshot,
  AgentId,
  LocalSkillGroupRow,
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
  computeContentHash?: (rootPath: string) => Promise<string>
}

export interface LocalSkillInventoryService {
  refresh(input: LocalSkillInventoryRefreshInput): Promise<LocalSkillsInventorySnapshot>
}

type ParsedSkillMetadata = {
  name: string | null
  slug: string | null
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
      slug: null,
      version: null
    }
  }

  const endIndex = normalized.indexOf("\n---", 4)

  if (endIndex < 0) {
    return {
      name: null,
      slug: null,
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
    slug: fields.get("slug") ?? null,
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
    name.includes("..") ||
    !/^[a-zA-Z0-9_.-]+$/.test(name)
  ) {
    throw new Error(`Invalid SKILL name: ${name}`)
  }

  return name
}

function resolveLocalSkillIdentity(metadata: ParsedSkillMetadata): string {
  const candidates = [metadata.slug, metadata.name]
  let invalidNameError: Error | null = null

  for (const candidate of candidates) {
    if (candidate === null) {
      continue
    }

    try {
      return validateLocalSkillName(candidate)
    } catch (error) {
      if (invalidNameError === null && error instanceof Error) {
        invalidNameError = error
      }
    }
  }

  if (invalidNameError !== null) {
    throw invalidNameError
  }

  return validateLocalSkillName(null)
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
  localVersion: string | null
}): LocalSkillServerState {
  if (args.validationState !== "valid") {
    return "invalid-local"
  }

  if (args.serverLookupStatus !== "ok") {
    return "unknown"
  }

  if (!args.name || !args.remoteSkill) {
    return "missing"
  }

  const remoteVersion = args.remoteSkill.version
  if (args.localVersion && remoteVersion) {
    const comparison = compareStrictSemverVersions(args.localVersion, remoteVersion)
    if (comparison === "installed-newer") {
      return "update-available"
    }
  }

  return "existing"
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

function compareLocalVersions(a: LocalSkillInventoryRow, b: LocalSkillInventoryRow): number {
  const aVer = parseStrictSemver(a.localVersion)
  const bVer = parseStrictSemver(b.localVersion)
  if (aVer && bVer) {
    if (aVer.major !== bVer.major) return bVer.major - aVer.major
    if (aVer.minor !== bVer.minor) return bVer.minor - aVer.minor
    return bVer.patch - aVer.patch
  }
  if (aVer) return -1
  if (bVer) return 1
  return 0
}

function pickPrimaryRow(items: LocalSkillInventoryRow[]): LocalSkillInventoryRow {
  const sorted = [...items].sort(compareLocalVersions)
  return sorted.find((r) => r.validationState === "valid" && (r.serverState === "existing" || r.serverState === "update-available"))
    ?? sorted.find((r) => r.validationState === "valid")
    ?? sorted[0]
}

function groupSkillRowsByName(rows: LocalSkillInventoryRow[]): LocalSkillGroupRow[] {
  const groups = new Map<string, LocalSkillInventoryRow[]>()

  for (const row of rows) {
    const key = row.name ?? row.rowKey
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(row)
  }

  const result: LocalSkillGroupRow[] = []

  for (const [, items] of groups) {
    if (items.length === 1) {
      const item = items[0]
      result.push({
        groupKey: item.rowKey,
        name: item.name ?? basename(item.packageRootPath),
        items: [item],
        primary: item,
        sourceDisplayNames: [...item.sourceDisplayNames],
        pathCount: 1,
        uploadable: item.uploadable,
        hasVersionConflict: false
      })
      continue
    }

    const versions = new Set(items.map((r) => r.localVersion ?? ""))
    const hasVersionConflict = versions.size > 1

    const primary = pickPrimaryRow(items)
    const allDisplayNames = [...new Set(items.flatMap((r) => r.sourceDisplayNames))]

    result.push({
      groupKey: items.map((r) => r.rowKey).join("|"),
      name: primary.name ?? basename(primary.packageRootPath),
      items,
      primary,
      sourceDisplayNames: allDisplayNames,
      pathCount: items.length,
      uploadable: items.some((r) => r.uploadable),
      hasVersionConflict
    })
  }

  return result.sort((a, b) => {
    const nameComparison = a.name.localeCompare(b.name)
    if (nameComparison !== 0) return nameComparison
    return a.primary.packageRootPath.localeCompare(b.primary.packageRootPath)
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
  const computeContentHash = dependencies.computeContentHash ?? computeSkillContentHash

  async function discoverCandidates(snapshot: AgentDetectionSnapshot): Promise<LocalCandidate[]> {
    const candidates: LocalCandidate[] = []
    const seen = new Set<string>()

    for (const target of snapshot.uniqueTargets) {
      let packageRootPaths: string[]

      try {
        packageRootPaths = await enumerateSkillDirectories(
          target.targetPath,
          target.skillLayout,
          readDirectory
        )
      } catch {
        continue
      }

      for (const packageRootPath of packageRootPaths) {
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
    computeContentHash: (rootPath: string) => Promise<string>
  }): Promise<LocalSkillInventoryRow> {
    let name: string | null = null
    let localVersion: string | null = null
    let validationState: LocalSkillValidationState = "valid"
    let validationError: unknown = null

    try {
      const skillMarkdown = await readTextFile(join(args.candidate.packageRootPath, "SKILL.md"), "utf8")
      const metadata = parseSkillFrontmatter(String(skillMarkdown))

      name = resolveLocalSkillIdentity(metadata)
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
    let serverState = createServerState({
      validationState,
      name,
      remoteSkill,
      serverLookupStatus: args.serverLookupStatus,
      localVersion
    })

    // Content-hash fallback: when the semver comparison cannot decide (version missing,
    // non-semver, or equal), compare the local package content hash against the server hash.
    if (serverState === "existing" && remoteSkill && remoteSkill.contentHash) {
      const comparison =
        localVersion && remoteSkill.version
          ? compareStrictSemverVersions(localVersion, remoteSkill.version)
          : "unknown"

      if (comparison !== "installed-older") {
        try {
          const localContentHash = await args.computeContentHash(args.candidate.packageRootPath)
          if (localContentHash !== remoteSkill.contentHash) {
            serverState = "update-available"
          }
        } catch {
          // Hash computation failed (e.g. unreadable file); keep the existing state.
        }
      }
    }

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
      uploadable: validationState === "valid" && (serverState === "missing" || serverState === "update-available")
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
            serverLookupStatus: input.serverLookupStatus,
            computeContentHash
          })
        )
      )

      const sortedRows = sortRows(rows)
      const groupedRows = groupSkillRowsByName(sortedRows)

      return {
        checkedAt: now().toISOString(),
        rows: sortedRows,
        groupedRows,
        serverLookupStatus: input.serverLookupStatus,
        serverLookupMessage: input.serverLookupMessage
      }
    }
  }
}
