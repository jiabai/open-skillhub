"use client"

import { LanguageToggle } from "@/components/app/language-toggle"

export function FloatingLanguageToggle() {
  return (
    <div className="fixed right-4 top-4 z-50">
      <LanguageToggle />
    </div>
  )
}
