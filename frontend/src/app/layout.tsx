import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { Fraunces, IBM_Plex_Sans, Inter } from "next/font/google"

import "./globals.css"
import { AppShell } from "@/components/app/app-shell"
import { RuntimeConfigProvider } from "@/components/app/runtime-config-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { localeCookieName, resolveRequestLocale } from "@/i18n/config"
import { getDictionary } from "@/i18n/get-dictionary"
import { I18nProvider } from "@/i18n/i18n-provider"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
})

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
})

function getRequestI18n() {
  const locale = resolveRequestLocale({
    cookieLocale: cookies().get(localeCookieName)?.value,
    acceptLanguage: headers().get("accept-language"),
  })

  return {
    locale,
    dictionary: getDictionary(locale),
  }
}

export function generateMetadata(): Metadata {
  const { dictionary } = getRequestI18n()

  return {
    title: dictionary.metadata.title,
    description: dictionary.metadata.description,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dictionary } = getRequestI18n()

  return (
    <html lang={locale} className={cn(displayFont.variable, bodyFont.variable, "font-sans", inter.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <I18nProvider locale={locale} dictionary={dictionary}>
            <RuntimeConfigProvider>
              <AppShell>{children}</AppShell>
            </RuntimeConfigProvider>
            <Toaster position="bottom-right" />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
