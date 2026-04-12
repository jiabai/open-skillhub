"use client"

import { useContext } from "react"

import { RuntimeConfigContext } from "@/components/app/runtime-config-provider"

export function useRuntimeConfig() {
  const context = useContext(RuntimeConfigContext)
  if (!context) {
    throw new Error("useRuntimeConfig must be used within RuntimeConfigProvider")
  }
  return context
}
