import skillVisibilities from "@/generated/skill-visibilities.json"

const catalog = skillVisibilities as {
  default: string
  values: readonly string[]
  writable: readonly string[]
  labels: Record<string, string>
}

export const SKILL_VISIBILITY_VALUES = catalog.values as readonly ["private", "team", "enterprise", "public"]
export type SkillVisible = (typeof SKILL_VISIBILITY_VALUES)[number]

export const WRITABLE_SKILL_VISIBILITY_VALUES = catalog.writable as readonly ["private", "team", "enterprise"]
export type WritableSkillVisible = (typeof WRITABLE_SKILL_VISIBILITY_VALUES)[number]

export const DEFAULT_SKILL_VISIBILITY = catalog.default as WritableSkillVisible
export const SKILL_VISIBILITY_LABELS = catalog.labels as Record<SkillVisible, string>

export const WRITABLE_SKILL_VISIBILITY_OPTIONS = WRITABLE_SKILL_VISIBILITY_VALUES.map((value) => ({
  value,
  label: SKILL_VISIBILITY_LABELS[value],
}))

export const isSkillVisibility = (value: string): value is SkillVisible =>
  (SKILL_VISIBILITY_VALUES as readonly string[]).includes(value)

export const isWritableSkillVisibility = (value: string): value is WritableSkillVisible =>
  (WRITABLE_SKILL_VISIBILITY_VALUES as readonly string[]).includes(value)

type SkillVisibilityLabels = {
  visibilityPrivate: string
  visibilityTeam: string
  visibilityEnterprise: string
  visibilityPublic?: string
}

export function getSkillVisibilityLabel(visibility: SkillVisible, labels: SkillVisibilityLabels): string {
  if (visibility === "private") {
    return labels.visibilityPrivate
  }
  if (visibility === "team") {
    return labels.visibilityTeam
  }
  if (visibility === "enterprise") {
    return labels.visibilityEnterprise
  }
  return labels.visibilityPublic ?? SKILL_VISIBILITY_LABELS.public
}
