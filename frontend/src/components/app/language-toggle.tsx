"use client"

import type { VariantProps } from "class-variance-authority"
import { Languages } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
import { localeCookieName, type AppLocale } from "@/i18n/config"
import { useI18n } from "@/i18n/use-i18n"

type LanguageToggleProps = {
  className?: string
  variant?: VariantProps<typeof buttonVariants>["variant"]
  size?: VariantProps<typeof buttonVariants>["size"]
}

export function LanguageToggle({
  className,
  variant = "outline",
  size = "sm",
}: LanguageToggleProps) {
  const router = useRouter()
  const { locale, dictionary } = useI18n()
  const nextLocale: AppLocale = locale === "zh-CN" ? "en-US" : "zh-CN"
  const label =
    nextLocale === "zh-CN"
      ? dictionary.languageToggle.chineseLabel
      : dictionary.languageToggle.englishLabel
  const ariaLabel =
    nextLocale === "zh-CN"
      ? dictionary.languageToggle.switchToChinese
      : dictionary.languageToggle.switchToEnglish

  const handleClick = () => {
    document.cookie = `${localeCookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`
    router.refresh()
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Languages className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  )
}
