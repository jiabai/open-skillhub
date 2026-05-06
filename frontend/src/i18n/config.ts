export const supportedLocales = ["en-US", "zh-CN"] as const

export type AppLocale = (typeof supportedLocales)[number]

export const defaultLocale: AppLocale = "zh-CN"
export const localeCookieName = "skilldrive.locale"

export function isSupportedLocale(value: string): value is AppLocale {
  return (supportedLocales as readonly string[]).includes(value)
}

export function normalizeLocale(value?: string | null): AppLocale | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().replace(/_/g, "-").toLowerCase()

  if (!normalized) {
    return null
  }

  if (normalized.startsWith("zh")) {
    return "zh-CN"
  }

  if (normalized.startsWith("en")) {
    return "en-US"
  }

  const exactMatch = supportedLocales.find((locale) => locale.toLowerCase() === normalized)
  return exactMatch ?? null
}

export function resolveRequestLocale(input: {
  cookieLocale?: string | null
  acceptLanguage?: string | null
} = {}): AppLocale {
  const cookieLocale = normalizeLocale(input.cookieLocale)
  if (cookieLocale) {
    return cookieLocale
  }

  if (input.acceptLanguage) {
    for (const entry of input.acceptLanguage.split(",")) {
      const [rawLocale] = entry.split(";")
      const resolvedLocale = normalizeLocale(rawLocale)
      if (resolvedLocale) {
        return resolvedLocale
      }
    }
  }

  return defaultLocale
}
