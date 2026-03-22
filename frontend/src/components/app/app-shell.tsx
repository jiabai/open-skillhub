"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, KeyRound, LayoutGrid, LogOut, Menu, ScrollText, ShieldCheck, Sparkles, User2, Wrench, X } from "lucide-react"

import { clearTokens, getStoredTokens } from "@/lib/api"
import { featureFlags } from "@/lib/feature-flags"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const navItems = [
  { href: "/dashboard", label: "概览", icon: LayoutGrid },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  ...(featureFlags.enableAuditLog ? [{ href: "/audit", label: "审计日志", icon: ScrollText }] : []),
  { href: "/profile", label: "个人信息", icon: User2 },
  { href: "/security", label: "安全", icon: ShieldCheck }
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthRoute = pathname === "/login" || pathname === "/register"
  const [isChecking, setIsChecking] = useState(!isAuthRoute)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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
      {/* Skip Link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:font-medium"
      >
        跳转到主内容
      </a>

      <header className="border-b border-border/80 backdrop-blur z-40 sticky top-0">
        <div className="container mx-auto max-w-screen-xl px-6 py-4">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3" aria-label="SkillHub 首页">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-lg">SkillHub</p>
                <p className="text-xs text-muted-foreground">多用户控制台</p>
              </div>
            </Link>

            {/* Desktop Actions */}
            <div className="flex items-center gap-2">
              <ThemeToggle />

              {/* Desktop Dropdown */}
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" aria-hidden="true" />
                        工作台
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Link href="/profile" className="flex w-full items-center gap-2">
                        <User2 className="h-4 w-4" aria-hidden="true" />
                        个人信息
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/security" className="flex w-full items-center gap-2">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        安全设置
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          退出登录
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
                          <AlertDialogDescription>
                            退出后需要重新登录才能访问您的账户。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            确认退出
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile Menu Button */}
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="outline" size="icon" aria-label="打开导航菜单">
                    <Menu className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                  <SheetHeader>
                    <SheetTitle>导航菜单</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-2 mt-6">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname.startsWith(item.href)
                      return (
                        <SheetClose asChild key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {item.label}
                          </Link>
                        </SheetClose>
                      )
                    })}
                    <div className="border-t border-border my-2" />
                    <SheetClose asChild>
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px] text-muted-foreground hover:bg-muted"
                      >
                        <User2 className="h-4 w-4" aria-hidden="true" />
                        个人信息
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        href="/security"
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px] text-muted-foreground hover:bg-muted"
                      >
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        安全设置
                      </Link>
                    </SheetClose>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px] text-destructive hover:bg-destructive/10 text-left"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          退出登录
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
                          <AlertDialogDescription>
                            退出后需要重新登录才能访问您的账户。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setMobileNavOpen(false)}>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              setMobileNavOpen(false)
                              handleLogout()
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            确认退出
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex mt-4 flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted focus-visible:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main id="main-content" className="container mx-auto max-w-screen-xl px-6 py-8" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
