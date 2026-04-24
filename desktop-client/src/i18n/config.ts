import type { AppLocale } from "@/types"

export const supportedLocales = ["en-US", "zh-CN"] as const satisfies readonly AppLocale[]

export const defaultLocale: AppLocale = "zh-CN"

export function isSupportedLocale(value: string): value is AppLocale {
  return (supportedLocales as readonly string[]).includes(value)
}

export function normalizeLocale(value?: string | null): AppLocale | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().replace(/_/g, "-")

  if (!normalized) {
    return null
  }

  const lowerCased = normalized.toLowerCase()

  if (lowerCased.startsWith("zh")) {
    return "zh-CN"
  }

  if (lowerCased.startsWith("en")) {
    return "en-US"
  }

  const exactMatch = supportedLocales.find((locale) => locale.toLowerCase() === lowerCased)
  return exactMatch ?? null
}

export function resolveLocale(value?: string | null): AppLocale {
  return normalizeLocale(value) ?? defaultLocale
}

