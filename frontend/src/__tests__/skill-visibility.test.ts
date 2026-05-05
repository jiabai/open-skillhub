import generatedSkillVisibilities from "@/generated/skill-visibilities.json"
import {
  DEFAULT_SKILL_VISIBILITY,
  SKILL_VISIBILITY_LABELS,
  SKILL_VISIBILITY_VALUES,
  WRITABLE_SKILL_VISIBILITY_OPTIONS,
  WRITABLE_SKILL_VISIBILITY_VALUES,
  isSkillVisibility,
  isWritableSkillVisibility,
} from "@/lib/skill-visibility"

describe("skill visibility catalog", () => {
  it("derives exported constants from the generated catalog", () => {
    expect(SKILL_VISIBILITY_VALUES).toEqual(generatedSkillVisibilities.values)
    expect(WRITABLE_SKILL_VISIBILITY_VALUES).toEqual(generatedSkillVisibilities.writable)
    expect(DEFAULT_SKILL_VISIBILITY).toBe(generatedSkillVisibilities.default)
    expect(SKILL_VISIBILITY_LABELS).toEqual(generatedSkillVisibilities.labels)
    expect(WRITABLE_SKILL_VISIBILITY_OPTIONS).toEqual(
      generatedSkillVisibilities.writable.map((value) => ({
        value,
        label: generatedSkillVisibilities.labels[value],
      }))
    )
  })

  it("distinguishes readable and writable values", () => {
    expect(isSkillVisibility("public")).toBe(true)
    expect(isWritableSkillVisibility("public")).toBe(false)
    expect(isWritableSkillVisibility("team")).toBe(true)
    expect(isSkillVisibility("hidden")).toBe(false)
  })
})
