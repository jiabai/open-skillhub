import { enUS, zhCN } from "date-fns/locale"

import type { AppLocale } from "@/i18n/config"

export function getDateFnsLocale(locale: AppLocale) {
  return locale === "zh-CN" ? zhCN : enUS
}
