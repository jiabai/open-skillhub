"use client"

import { MoonStar, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/use-i18n"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { dictionary } = useI18n()
  const isDark = theme === "dark"

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={dictionary.themeToggle.switchTheme}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </Button>
  )
}
