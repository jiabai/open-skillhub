"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, KeyRound, LayoutGrid, LogOut, ScrollText, ShieldCheck, Sparkles, User2, Wrench } from "lucide-react"

import { clearTokens, getStoredTokens } from "@/lib/api"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/app/theme-toggle"

const navItems = [
  { href: "/dashboard", label: "概览", icon: LayoutGrid },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  { href: "/audit", label: "审计日志", icon: ScrollText },
  { href: "/profile", label: "个人信息", icon: User2 },
  { href: "/security", label: "安全", icon: ShieldCheck }
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthRoute = pathname === "/login" || pathname === "/register"
  const [isChecking, setIsChecking] = useState(!isAuthRoute)

  useEffect(() => {
    if (isAuthRoute) {
      setIsChecking(false)
      return
    }
    const tokens = getStoredTokens()
    if (!tokens?.access_token) {
      router.replace("/login")
      return
    }
    setIsChecking(false)
  }, [isAuthRoute, router])

  const handleLogout = () => {
    clearTokens()
    router.replace("/login")
  }

  if (isAuthRoute) {
    return <main className="min-h-screen">{children}</main>
  }

  if (isChecking) {
    return <main className="min-h-screen" />
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--secondary)),_transparent_60%),_linear-gradient(to_bottom,_hsl(var(--muted)_/_0.8),_transparent)]">
      <header className="border-b border-border/80 backdrop-blur">
        <div className="container mx-auto max-w-screen-xl px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-lg">SkillHub</p>
                  <p className="text-xs text-muted-foreground">多用户控制台</p>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        工作台
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Link href="/profile" className="flex w-full items-center gap-2">
                        <User2 className="h-4 w-4" />
                        个人信息
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/security" className="flex w-full items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        安全设置
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onSelect={handleLogout}>
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <nav className="mt-4 flex flex-wrap gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
        </div>
      </header>
      <main className="container mx-auto max-w-screen-xl px-6 py-8">{children}</main>
    </div>
  )
}
