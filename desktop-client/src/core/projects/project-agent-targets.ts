import { createHash } from "node:crypto"
import { posix, win32 } from "node:path"

import {
  supportedAgentDefinitions,
  type AgentPathDefinition,
  type AgentProjectTargetDefinition
} from "@/adapters/agents/definitions"
import type { ProjectAgentTarget, ProjectEntry } from "@/types"

export interface ProjectAgentTargetOptions {
  definitions?: AgentPathDefinition[]
  platform?: NodeJS.Platform
}

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix
}

function createDedupeKey(pathValue: string, platform: NodeJS.Platform): string {
  const normalized = getPathModule(platform).normalize(pathValue)

  return platform === "win32" ? normalized.toLocaleLowerCase() : normalized
}

function createTargetId(dedupeKey: string): string {
  return createHash("sha256").update(dedupeKey).digest("hex").slice(0, 16)
}

function assertProjectRelativeTargetPath(
  projectRoot: string,
  target: AgentProjectTargetDefinition,
  platform: NodeJS.Platform
): { targetPath: string; relativePath: string } {
  const pathModule = getPathModule(platform)
  const normalizedTargetPath = pathModule.normalize(target.path)

  if (!normalizedTargetPath || pathModule.isAbsolute(normalizedTargetPath)) {
    throw new Error(`Project target path must be project-relative: ${target.path}`)
  }

  const targetPath = pathModule.normalize(pathModule.join(projectRoot, normalizedTargetPath))
  const relativePath = pathModule.normalize(pathModule.relative(projectRoot, targetPath))

  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${pathModule.sep}`) ||
    pathModule.isAbsolute(relativePath)
  ) {
    throw new Error(`Project target path must stay inside the project root: ${target.path}`)
  }

  return {
    targetPath,
    relativePath
  }
}

export function resolveProjectAgentTargets(
  project: ProjectEntry,
  options: ProjectAgentTargetOptions = {}
): ProjectAgentTarget[] {
  const definitions = options.definitions ?? supportedAgentDefinitions
  const platform = options.platform ?? process.platform
  const pathModule = getPathModule(platform)
  const projectRoot = pathModule.normalize(project.path)
  const targetsByPath = new Map<string, ProjectAgentTarget>()

  for (const definition of definitions) {
    for (const projectTarget of definition.projectTargets ?? []) {
      const resolved = assertProjectRelativeTargetPath(projectRoot, projectTarget, platform)
      const dedupeKey = createDedupeKey(resolved.targetPath, platform)
      const existing = targetsByPath.get(dedupeKey)
      const writable = projectTarget.role === "primary"

      if (existing) {
        if (!existing.coveredAgentIds.includes(definition.id)) {
          existing.coveredAgentIds.push(definition.id)
          existing.displayNames.push(definition.displayName)
        }

        if (writable && !existing.writableAgentIds.includes(definition.id)) {
          existing.writableAgentIds.push(definition.id)
        }

        if (existing.sharedPathKey === null && projectTarget.sharedPathKey) {
          existing.sharedPathKey = projectTarget.sharedPathKey
        }

        if (!existing.writable && writable) {
          existing.writable = true
          existing.primaryAgentId = definition.id
        }

        continue
      }

      targetsByPath.set(dedupeKey, {
        targetId: createTargetId(dedupeKey),
        targetPath: resolved.targetPath,
        relativePath: resolved.relativePath,
        primaryAgentId: definition.id,
        coveredAgentIds: [definition.id],
        writableAgentIds: writable ? [definition.id] : [],
        displayNames: [definition.displayName],
        sharedPathKey: projectTarget.sharedPathKey ?? null,
        writable
      })
    }
  }

  return Array.from(targetsByPath.values())
}
