import { describe, expect, it } from "vitest"

import { defaultLocale, normalizeLocale, resolveRequestLocale } from "@/i18n/config"
import { getDictionary } from "@/i18n/get-dictionary"

describe("i18n config", () => {
  it("normalizes supported locale aliases", () => {
    expect(normalizeLocale("en")).toBe("en-US")
    expect(normalizeLocale("en_GB")).toBe("en-US")
    expect(normalizeLocale("zh")).toBe("zh-CN")
    expect(normalizeLocale("zh-Hans-CN")).toBe("zh-CN")
  })

  it("prefers the locale cookie over Accept-Language", () => {
    expect(
      resolveRequestLocale({
        cookieLocale: "zh-CN",
        acceptLanguage: "en-US,en;q=0.9",
      })
    ).toBe("zh-CN")
  })

  it("falls back to the default locale when no supported value is provided", () => {
    expect(resolveRequestLocale()).toBe(defaultLocale)
    expect(resolveRequestLocale({ acceptLanguage: "fr-FR,fr;q=0.9" })).toBe(defaultLocale)
  })

  it("returns domain dictionaries for each locale", () => {
    expect(getDictionary("en-US").metadata.title).toBe("SkillDrive Console")
    expect(getDictionary("zh-CN").metadata.title).toBe("SkillDrive 控制台")
  })

  it("defaults to zh-CN", () => {
    expect(defaultLocale).toBe("zh-CN")
  })
})
