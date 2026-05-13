import { readdir } from "node:fs/promises"
import { join, normalize } from "node:path"

import type { AgentSkillLayout } from "@/types"

export type DirectoryEntry = {
  name: string
  isDirectory(): boolean
}

export type ReadDirectory = (
  path: string,
  options: { withFileTypes: true }
) => Promise<DirectoryEntry[]>

export type InstalledSkillDirectoryLookup =
  | { status: "missing"; skillDir: string }
  | { status: "found"; skillDir: string }
  | { status: "ambiguous"; skillDirs: string[] }

const FLAT_LAYOUT: AgentSkillLayout = { mode: "flat" }

function normalizePathSegment(value: string, label: string, allowLeadingDot = false): string {
  const normalized = value.trim()

  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..") ||
    (!allowLeadingDot && normalized.startsWith("."))
  ) {
    throw new Error(`Invalid ${label}: ${value}`)
  }

  return normalized
}

export function createSafeSkillDirectoryName(skillDirectoryNameValue: string): string {
  const normalized = skillDirectoryNameValue.trim()

  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new Error(`Invalid skill directory name: ${skillDirectoryNameValue}`)
  }

  return normalized
}

export function validateSkillCategoryName(value: string): string {
  return normalizePathSegment(value, "skill category name")
}

export function normalizeSkillLayout(layout: AgentSkillLayout | null | undefined): AgentSkillLayout {
  if (!layout || layout.mode === "flat") {
    return FLAT_LAYOUT
  }

  if (layout.categoryDepth !== 1) {
    throw new Error(`Unsupported categorized skill layout depth: ${layout.categoryDepth}`)
  }

  if (layout.categorySource !== "agent-default") {
    throw new Error(`Unsupported categorized skill category source: ${layout.categorySource}`)
  }

  return {
    mode: "categorized",
    categoryDepth: 1,
    defaultCategory: validateSkillCategoryName(layout.defaultCategory),
    categorySource: layout.categorySource,
    ...(layout.allowRootSkills ? { allowRootSkills: true } : {})
  }
}

export function skillLayoutsEqual(
  left: AgentSkillLayout | null | undefined,
  right: AgentSkillLayout | null | undefined
): boolean {
  const normalizedLeft = normalizeSkillLayout(left)
  const normalizedRight = normalizeSkillLayout(right)

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight)
}

export function resolveSkillInstallPath(
  targetPath: string,
  skillName: string,
  layout: AgentSkillLayout | null | undefined
): string {
  const safeSkillName = createSafeSkillDirectoryName(skillName)
  const normalizedLayout = normalizeSkillLayout(layout)

  if (normalizedLayout.mode === "flat") {
    return join(targetPath, safeSkillName)
  }

  return join(targetPath, normalizedLayout.defaultCategory, safeSkillName)
}

export function resolveMissingSkillPath(
  targetPath: string,
  skillName: string,
  layout: AgentSkillLayout | null | undefined
): string {
  return resolveSkillInstallPath(targetPath, skillName, layout)
}

async function readDirectoryEntries(
  readDirectory: ReadDirectory,
  path: string
): Promise<DirectoryEntry[]> {
  try {
    return await readDirectory(path, { withFileTypes: true })
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return []
    }

    throw error
  }
}

export async function enumerateSkillDirectories(
  targetPath: string,
  layout: AgentSkillLayout | null | undefined,
  readDirectory: ReadDirectory = readdir
): Promise<string[]> {
  const normalizedLayout = normalizeSkillLayout(layout)
  const candidates: string[] = []

  async function collectFlatCandidates(rootPath: string): Promise<void> {
    const entries = await readDirectoryEntries(readDirectory, rootPath)

    for (const entry of entries) {
      if (entry.isDirectory()) {
        candidates.push(normalize(join(rootPath, entry.name)))
      }
    }
  }

  if (normalizedLayout.mode === "flat") {
    await collectFlatCandidates(targetPath)
    return candidates
  }

  if (normalizedLayout.allowRootSkills) {
    await collectFlatCandidates(targetPath)
  }

  const categories = await readDirectoryEntries(readDirectory, targetPath)

  for (const category of categories) {
    if (!category.isDirectory()) {
      continue
    }

    try {
      validateSkillCategoryName(category.name)
    } catch {
      continue
    }

    const categoryPath = join(targetPath, category.name)
    const entries = await readDirectoryEntries(readDirectory, categoryPath)

    for (const entry of entries) {
      if (entry.isDirectory()) {
        candidates.push(normalize(join(categoryPath, entry.name)))
      }
    }
  }

  return candidates
}

export async function findInstalledSkillDirectory(
  targetPath: string,
  skillName: string,
  layout: AgentSkillLayout | null | undefined,
  readDirectory: ReadDirectory = readdir
): Promise<InstalledSkillDirectoryLookup> {
  const safeSkillName = createSafeSkillDirectoryName(skillName)
  const normalizedLayout = normalizeSkillLayout(layout)

  if (normalizedLayout.mode === "flat") {
    return {
      status: "found",
      skillDir: join(targetPath, safeSkillName)
    }
  }

  const matches: string[] = []
  const categories = await readDirectoryEntries(readDirectory, targetPath)

  if (normalizedLayout.allowRootSkills) {
    const rootEntries = await readDirectoryEntries(readDirectory, targetPath)
    const rootMatch = rootEntries.find(
      (entry) => entry.isDirectory() && entry.name === safeSkillName
    )

    if (rootMatch) {
      matches.push(normalize(join(targetPath, rootMatch.name)))
    }
  }

  for (const category of categories) {
    if (!category.isDirectory()) {
      continue
    }

    try {
      validateSkillCategoryName(category.name)
    } catch {
      continue
    }

    const categoryPath = join(targetPath, category.name)
    const entries = await readDirectoryEntries(readDirectory, categoryPath)
    const match = entries.find((entry) => entry.isDirectory() && entry.name === safeSkillName)

    if (match) {
      matches.push(normalize(join(categoryPath, match.name)))
    }
  }

  if (matches.length === 0) {
    return {
      status: "missing",
      skillDir: resolveMissingSkillPath(targetPath, safeSkillName, normalizedLayout)
    }
  }

  if (matches.length === 1) {
    return {
      status: "found",
      skillDir: matches[0]
    }
  }

  return {
    status: "ambiguous",
    skillDirs: matches
  }
}
