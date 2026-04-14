"use client"

import { useContext } from "react"

import { I18nContext } from "@/i18n/i18n-provider"

export function useI18n() {
  return useContext(I18nContext)
}
