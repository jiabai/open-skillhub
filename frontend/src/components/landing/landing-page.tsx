"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Boxes, CheckCircle2, Database, KeyRound, Laptop, Layers3, ShieldCheck, BarChart3, LogOut, User2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LanguageToggle } from "@/components/app/language-toggle"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { useI18n } from "@/i18n/use-i18n"
import { cn } from "@/lib/utils"
import { clearTokens, api } from "@/lib/api"
import { useCurrentUser } from "@/components/app/current-user-context"
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
import type { User } from "@/types"

type SkillPreview = {
  name: string
  visibility: string
  version: string
  status: string
}

interface LandingPageProps {
  currentUser?: User | null
}

export function LandingPage({ currentUser: propsCurrentUser }: LandingPageProps) {
  const { dictionary } = useI18n()
  const { landing, appShell, navigation } = dictionary
  const router = useRouter()
  const { currentUser: contextCurrentUser } = useCurrentUser()
  const currentUser = propsCurrentUser || contextCurrentUser

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

  // Default values for when we don't receive appShell or navigation (for tests)
  const safeAppShell = appShell || {
    workbench: "工作台",
    signOut: "退出登录",
    signOutTitle: "确认退出？",
    signOutDescription: "你确定要退出当前账户吗？",
    cancel: "取消"
  }
  const safeNavigation = navigation || {
    profile: "个人资料",
    security: "安全设置"
  }

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <PublicNavbar 
          landing={landing} 
          appShell={safeAppShell} 
          navigation={safeNavigation}
          currentUser={currentUser} 
          onLogout={handleLogout}
        />

        <section className="relative z-10 grid flex-1 items-center gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] lg:gap-12 lg:py-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              {landing.badge}
            </div>

            <h1 className="mt-7 max-w-2xl font-display text-[40px] font-bold leading-[1.05] tracking-normal text-foreground sm:text-[56px] lg:text-[72px]">
              {landing.title}
            </h1>
            <p className="mt-6 max-w-2xl font-body text-lg leading-8 tracking-normal text-muted-foreground">
              {landing.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="min-h-[48px] rounded-md px-5 transition-transform hover:-translate-y-0.5">
                <Link href="/register">
                  {landing.primaryCta}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-[48px] rounded-md px-5 transition-colors">
                <Link href="/public-skills">{landing.secondaryCta}</Link>
              </Button>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3" aria-label={landing.navFeatures}>
              {[landing.featureVersioned, landing.featurePrivate, landing.featureClientReady].map((feature) => (
                <div key={feature} className="flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-2 text-sm text-card-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <LandingControlRoomPreview />
        </section>

        <CapabilityProofStrip />
      </div>
    </div>
  )
}

interface PublicNavbarProps {
  landing: ReturnType<typeof useI18n>["dictionary"]["landing"]
  appShell: ReturnType<typeof useI18n>["dictionary"]["appShell"]
  navigation: ReturnType<typeof useI18n>["dictionary"]["navigation"]
  currentUser?: User | null
  onLogout: () => Promise<void>
}

function PublicNavbar({ landing, appShell, navigation, currentUser, onLogout }: PublicNavbarProps) {
  return (
    <header className="relative z-20">
      <nav className="mx-auto flex min-h-[64px] max-w-screen-2xl items-center justify-between rounded-md border border-border/80 bg-card/85 px-4 py-3 shadow-sm backdrop-blur">
        <Link href={currentUser ? "/dashboard" : "/"} className="flex items-center gap-3" aria-label={landing.title}>
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-xl font-bold tracking-normal">{landing.title}</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            {!currentUser ? (
              <>
                <a href="#features" className="transition-colors hover:text-foreground">
                  {landing.navFeatures}
                </a>
                <Link href="/public-skills" className="transition-colors hover:text-foreground">
                  {landing.navPublicSkills}
                </Link>
                <Link href="/login" className="transition-colors hover:text-foreground">
                  {landing.navSignIn}
                </Link>
                <Button asChild size="sm" className="rounded-md">
                  <Link href="/register">{landing.navCreateAccount}</Link>
                </Button>
              </>
            ) : (
              <>
                <Link href="/public-skills" className="transition-colors hover:text-foreground">
                  {landing.navPublicSkills}
                </Link>
                <Link href="/dashboard" className="transition-colors hover:text-foreground">
                  {appShell.workbench}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <span className="flex items-center gap-2">
                        <User2 className="h-4 w-4" aria-hidden="true" />
                        {currentUser.username || currentUser.email}
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
                          <AlertDialogAction onClick={() => void onLogout()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {appShell.signOut}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  )
}

function LandingControlRoomPreview() {
  const { dictionary } = useI18n()
  const { landing } = dictionary
  const skills = [landing.skills.reviewChecklist, landing.skills.releaseNotes, landing.skills.securityAudit]

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div className="relative min-h-[520px] overflow-hidden rounded-md border border-border bg-card shadow-[0_24px_80px_hsl(var(--foreground)_/_0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/60 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{landing.controlRoomKicker}</p>
            <h2 className="font-display text-2xl font-bold tracking-normal text-card-foreground">{landing.controlRoomTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-full bg-secondary px-3 py-1">{landing.privateRegistry}</span>
            <span className="rounded-full bg-secondary px-3 py-1">{landing.skillsTracked}</span>
            <span className="rounded-full bg-secondary px-3 py-1">{landing.apiTokenScoped}</span>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[1.05fr_0.95fr]">
          <LandingSkillRegistryPanel title={landing.registryTitle} skills={skills} />
          <div className="grid gap-4">
            <LandingVersionRail />
            <LandingDistributionMap />
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-md border border-border bg-background/90 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
          <span>{landing.syncTicker}</span>
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

function LandingSkillRegistryPanel({ title, skills }: { title: string; skills: SkillPreview[] }) {
  return (
    <section className="min-h-[320px] rounded-md border border-border bg-background/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-body text-sm font-semibold tracking-normal text-foreground">{title}</h3>
        <Database className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>
      <div className="grid gap-3">
        {skills.map((skill, index) => (
          <article
            key={skill.name}
            className={cn(
              "rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50",
              index === 0 && "border-primary/40"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-body text-base font-semibold tracking-normal text-foreground">{skill.name}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{skill.status}</p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{skill.visibility}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">current</span>
              <span className="font-medium text-primary">{skill.version}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function LandingVersionRail() {
  const { dictionary } = useI18n()
  const versions = [dictionary.landing.versions.created, dictionary.landing.versions.reviewed, dictionary.landing.versions.active]

  return (
    <section className="rounded-md border border-border bg-background/80 p-4">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-body text-sm font-semibold tracking-normal text-foreground">{dictionary.landing.railTitle}</h3>
        <Layers3 className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>
      <ol className="relative grid gap-4 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border">
        {versions.map((version, index) => (
          <li key={version} className="relative flex items-center gap-3 text-sm">
            <span
              className={cn(
                "z-10 h-3.5 w-3.5 rounded-full border bg-background",
                index === versions.length - 1 ? "border-primary bg-primary" : "border-border"
              )}
              aria-hidden="true"
            />
            <span className={cn("text-muted-foreground", index === versions.length - 1 && "font-medium text-foreground")}>{version}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function LandingDistributionMap() {
  const { dictionary } = useI18n()
  const nodes = [
    { label: dictionary.landing.distribution.apiToken, icon: KeyRound },
    { label: dictionary.landing.distribution.desktopSync, icon: Laptop },
    { label: dictionary.landing.distribution.publicCatalog, icon: Database },
  ]

  return (
    <section className="rounded-md border border-border bg-background/80 p-4">
      <h3 className="mb-4 font-body text-sm font-semibold tracking-normal text-foreground">{dictionary.landing.distributionTitle}</h3>
      <div className="grid gap-3">
        {nodes.map(({ label, icon: Icon }) => (
          <div key={label} className="flex min-h-[48px] items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function CapabilityProofStrip() {
  const { dictionary } = useI18n()
  const { landing } = dictionary
  const items = [
    { title: landing.proof.versionedTitle, text: landing.proof.versionedText },
    { title: landing.proof.privateTitle, text: landing.proof.privateText },
    { title: landing.proof.publicTitle, text: landing.proof.publicText },
    { title: landing.proof.clientTitle, text: landing.proof.clientText },
  ]

  return (
    <section id="features" className="relative z-10 grid gap-3 pb-8 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <article key={item.title} className="min-h-[132px] rounded-md border border-border bg-card/85 p-4">
          <h2 className="font-body text-sm font-semibold tracking-normal text-foreground">{item.title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
        </article>
      ))}
    </section>
  )
}
