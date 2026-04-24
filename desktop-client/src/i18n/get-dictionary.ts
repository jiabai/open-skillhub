import { defaultLocale, type AppLocale } from "@/i18n/config"
import type { AppDictionary } from "@/i18n/messages/types"
import { enUSDictionary } from "@/i18n/messages/en-US"
import { zhCNDictionary } from "@/i18n/messages/zh-CN"

const dictionaries: Record<AppLocale, AppDictionary> = {
  "en-US": enUSDictionary,
  "zh-CN": zhCNDictionary
}

export const defaultDictionary = dictionaries[defaultLocale]

export function getDictionary(locale: AppLocale): AppDictionary {
  return dictionaries[locale] ?? defaultDictionary
}

