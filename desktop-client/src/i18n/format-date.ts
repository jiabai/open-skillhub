import type { AppLocale } from "@/types"

export function formatDateTime(
  locale: AppLocale,
  value: string | null,
  options: Intl.DateTimeFormatOptions,
  fallback: string
): string {
  if (!value) {
    return fallback
  }

  return new Intl.DateTimeFormat(locale, options).format(new Date(value))
}

