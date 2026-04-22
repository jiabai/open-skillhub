"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, LogOut, Menu, User2, Wrench } from "lucide-react"

import { api, clearTokens, getStoredTokens } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import { getPrimaryNavigation } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import type { User } from "@/types"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { LanguageToggle } from "@/components/app/language-toggle"
import { Button } from "@/components/ui/button"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useI18n } from "@/i18n/use-i18n"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthRoute = pathname === "/login" || pathname === "/register"
  const { config } = useRuntimeConfig()
  const { dictionary } = useI18n()
  const { appShell, navigation } = dictionary
  const [isChecking, setIsChecking] = useState(!isAuthRoute)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    let cancelled = false

    if (isAuthRoute) {
      const tokens = getStoredTokens()
      if (tokens?.access_token) {
        router.replace("/dashboard")
        return () => {
          cancelled = true
        }
      }
      setIsChecking(false)
      return () => {
        cancelled = true
      }
    }

    const tokens = getStoredTokens()
    if (!tokens?.access_token) {
      router.replace("/login")
      return () => {
        cancelled = true
      }
    }

    const fetchUser = async () => {
      try {
        const user = await api.getMe()
        if (cancelled) return
        setCurrentUser(user)
        setIsChecking(false)
      } catch {
        if (cancelled) return
        clearTokens()
        setCurrentUser(null)
        setIsChecking(false)
        router.replace("/login")
      }
    }

    fetchUser()

    return () => {
      cancelled = true
    }
  }, [isAuthRoute, router])

  const rbacEnabled = config.capabilities.rbac
  const canManageUsers = currentUser?.is_superuser || currentUser?.role === "admin"
  const navItems = getPrimaryNavigation({
    rbacEnabled,
    canManageUsers: Boolean(canManageUsers),
    enableAuditLog: config.capabilities.audit_log,
    labels: navigation,
  })

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      // Always clear local credentials, even if the revoke request fails.
    } finally {
      clearTokens()
      router.replace("/login")
    }
  }

  if (isAuthRoute) {
    return <main className="min-h-screen">{children}</main>
  }

  if (isChecking) {
    return <main className="min-h-screen" />
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--secondary)),_transparent_60%),_linear-gradient(to_bottom,_hsl(var(--muted)_/_0.8),_transparent)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:left-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground"
      >
        {appShell.skipToMainContent}
      </a>

      <header className="sticky top-0 z-40 border-b border-border/80 backdrop-blur">
        <div className="container mx-auto max-w-screen-xl px-6 py-4 3xl:max-w-screen-2xl 4k:max-w-screen-3xl">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-3" aria-label={appShell.homeAriaLabel}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-lg">{appShell.brandLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {rbacEnabled ? appShell.governedConsole : appShell.personalWorkspace}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />

              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" aria-hidden="true" />
                        {appShell.workbench}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Link href="/profile" className="flex w-full items-center gap-2">
                        <User2 className="h-4 w-4" aria-hidden="true" />
                        {navigation.profile}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/security" className="flex w-full items-center gap-2">
                        <User2 className="h-4 w-4" aria-hidden="true" />
                        {navigation.security}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          {appShell.signOut}
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{appShell.signOutTitle}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {appShell.signOutDescription}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{appShell.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleLogout()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {appShell.signOut}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="outline" size="icon" aria-label={appShell.openNavigationMenu}>
                    <Menu className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                  <SheetHeader>
                    <SheetTitle>{appShell.navigation}</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 flex flex-col gap-2">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname.startsWith(item.href)

                      return (
                        <SheetClose asChild key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                              isActive ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {item.label}
                          </Link>
                        </SheetClose>
                      )
                    })}
                    <div className="my-2 border-t border-border" />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          {appShell.signOut}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{appShell.signOutTitle}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {appShell.signOutDescription}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setMobileNavOpen(false)}>{appShell.cancel}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              setMobileNavOpen(false)
                              void handleLogout()
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {appShell.signOut}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <nav className="mt-4 hidden flex-wrap gap-2 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted focus-visible:bg-muted"
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

      <main id="main-content" className="container mx-auto max-w-screen-xl px-6 py-8 3xl:max-w-screen-2xl 4k:max-w-screen-3xl" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
