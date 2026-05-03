"use client"

import React, { createContext, useContext } from "react"
import type { User } from "@/types"

interface CurrentUserContextType {
  currentUser: User | null
}

const CurrentUserContext = createContext<CurrentUserContextType>({
  currentUser: null,
})

export function CurrentUserProvider({
  children,
  currentUser,
}: {
  children: React.ReactNode
  currentUser: User | null
}) {
  return (
    <CurrentUserContext.Provider value={{ currentUser }}>
      {children}
    </CurrentUserContext.Provider>
  )
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext)
  if (!context) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider")
  }
  return context
}
