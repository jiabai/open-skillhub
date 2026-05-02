import { MoonStar, Sun } from "lucide-react"

import { Button } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"
import type { AppTheme } from "@/types"

type ThemeToggleProps = {
  theme: AppTheme
  disabled?: boolean
  onToggleTheme: () => void
}

export function ThemeToggle({ theme, disabled, onToggleTheme }: ThemeToggleProps) {
  const { dictionary } = useI18n()
  const isDark = theme === "dark"
  const Icon = isDark ? Sun : MoonStar

  return (
    <Button
      aria-label={dictionary.themeToggle.switchTheme}
      className="theme-toggle"
      disabled={disabled}
      onClick={onToggleTheme}
      size="icon"
      variant="outline"
    >
      <Icon aria-hidden="true" className="theme-toggle__icon" />
    </Button>
  )
}
