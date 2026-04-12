import type { Metadata } from "next"
import { Fraunces, IBM_Plex_Sans, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/app/app-shell"
import { RuntimeConfigProvider } from "@/components/app/runtime-config-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
})

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body"
})

export const metadata: Metadata = {
  title: "SkillHub 控制台",
  description: "多用户 Skill Hub 控制台"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={cn(displayFont.variable, bodyFont.variable, "font-sans", inter.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <RuntimeConfigProvider>
            <AppShell>{children}</AppShell>
          </RuntimeConfigProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
