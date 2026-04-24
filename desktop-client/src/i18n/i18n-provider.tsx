import { createContext, type ReactNode } from "react"

import { defaultLocale, type AppLocale } from "@/i18n/config"
import { defaultDictionary } from "@/i18n/get-dictionary"
import type { AppDictionary } from "@/i18n/messages/types"

export interface I18nContextValue {
  locale: AppLocale
  dictionary: AppDictionary
}

export const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  dictionary: defaultDictionary
})

type I18nProviderProps = {
  locale: AppLocale
  dictionary: AppDictionary
  children: ReactNode
}

export function I18nProvider({ locale, dictionary, children }: I18nProviderProps) {
  return <I18nContext.Provider value={{ locale, dictionary }}>{children}</I18nContext.Provider>
}

