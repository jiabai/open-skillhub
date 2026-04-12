"use client"

import { createContext, useEffect, useMemo, useState } from "react"

import {
  defaultRuntimeConfig,
  getRuntimeConfigSnapshot,
  loadRuntimeConfig,
  subscribeRuntimeConfig,
  type RuntimeConfig,
} from "@/lib/runtime-config"

type RuntimeConfigContextValue = {
  config: RuntimeConfig
  isLoading: boolean
}

export const RuntimeConfigContext = createContext<RuntimeConfigContextValue | null>(null)

export function RuntimeConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RuntimeConfig>(getRuntimeConfigSnapshot())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeRuntimeConfig(() => {
      setConfig(getRuntimeConfigSnapshot())
    })
    const controller = new AbortController()

    loadRuntimeConfig(controller.signal).finally(() => {
      setIsLoading(false)
    })

    return () => {
      controller.abort()
      unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      config: config ?? defaultRuntimeConfig,
      isLoading,
    }),
    [config, isLoading]
  )

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>
}
