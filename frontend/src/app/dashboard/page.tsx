"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Database, KeyRound, Shield, Sparkles, UploadCloud } from "lucide-react"

import { ModeBoundaryNote } from "@/components/app/mode-boundary-note"
import { NextStepCard } from "@/components/app/next-step-card"
import { PageIntro } from "@/components/app/page-intro"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAppMode } from "@/lib/app-mode"
import { api } from "@/lib/api"
import { featureFlags } from "@/lib/feature-flags"
import { getPrimaryNavigation } from "@/lib/navigation"
import type { DashboardOverview, SkillCachePolicyResponse } from "@/types"

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [cachePolicy, setCachePolicy] = useState<SkillCachePolicyResponse | null>(null)
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const appMode = getAppMode()

  useEffect(() => {
    const load = async () => {
      setStatus("loading")
      setError(null)
      try {
        const [overviewData, cachePolicyData, currentUser] = await Promise.all([
          api.getDashboardOverview(),
          api.getSkillCachePolicy().catch(() => null),
          appMode === "rbac" ? api.getMe().catch(() => null) : Promise.resolve(null),
        ])
        setOverview(overviewData)
        setCachePolicy(cachePolicyData)
        setCanManageUsers(Boolean(currentUser?.is_superuser || currentUser?.role === "admin"))
        setStatus("ready")
      } catch (err) {
        setStatus("error")
        setError(err instanceof Error ? err.message : "Failed to load dashboard")
      }
    }

    load()
  }, [appMode])

  const quickAccessItems = useMemo(
    () =>
      getPrimaryNavigation(appMode, {
        canManageUsers,
        enableAuditLog: featureFlags.enableAuditLog,
      }).filter((item) => ["/skills", "/public-skills", "/tokens", "/audit", "/admin/users"].includes(item.href)),
    [appMode, canManageUsers]
  )

  if (appMode === "no-rbac") {
    return (
      <div className="flex flex-col gap-6">
        <PageIntro
          title="Workspace"
          summary="Use this workspace to discover public Skills, manage your own private Skills, and connect client access with tokens."
        />
        <ModeBoundaryNote mode={appMode} />

        {status === "error" ? (
          <Card className="border-destructive/50">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Start Here</h2>
            <p className="text-sm text-muted-foreground">Pick the fastest path based on what you want to do first.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <NextStepCard
              title="Browse Public Skills"
              description="Start with a reference if you want to use a public Skill quickly without copying files."
              href="/public-skills"
              actionLabel="Open Public Skills"
            />
            <NextStepCard
              title="Upload Your Own Skill"
              description="Create a private Skill from a ZIP archive that contains a `SKILL.md` file."
              href="/skills/new"
              actionLabel="Upload Skill"
            />
            <NextStepCard
              title="Create a Token"
              description="Create a token when you are ready to let your own MCP or client tools access visible Skills."
              href="/tokens"
              actionLabel="Open Tokens"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">My Workspace Snapshot</h2>
            <p className="text-sm text-muted-foreground">A quick view of what is available in your personal workspace.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>My Skills</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{overview?.active_skills ?? "—"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>My Tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{overview?.available_tokens ?? "—"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cache & Access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {cachePolicy ? `Cache TTL ${Math.floor(cachePolicy.cache_ttl_seconds / 60)} min` : "Runtime policy unavailable"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {cachePolicy?.download_encryption_enabled ? "Download encryption enabled" : "Download encryption disabled"}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Need To Know</h2>
            <p className="text-sm text-muted-foreground">These boundaries matter before you choose reference, clone, or token access.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Public Skills
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Public Skills are reusable starting points. In this mode they are a shared library, not a public editing space.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UploadCloud className="h-4 w-4 text-primary" />
                  Reference vs Clone
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Use a reference when you want to start fast. Use a clone when you need your own editable copy and version flow.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Token Access
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Managing Skills in the browser and letting your own client use them are separate steps. Tokens unlock client access.
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Overview"
        summary="Review governance signals, scoped Skill activity, and operational access across the console."
        actions={
          <Button asChild>
            <Link href="/skills">
              Open Skills
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <ModeBoundaryNote mode={appMode} />

      {status === "error" ? (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Team / Org Overview</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {overview ? `${overview.active_skills} active Skills currently available in scope.` : "Loading scope overview..."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Skill Governance</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Track visibility, ownership, and effective version behavior before users depend on those Skills.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Audit & Access</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {cachePolicy?.download_encryption_enabled ? "Encrypted download policies are active." : "Review audit, token, and download controls."}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 text-primary" />
              <span>Review scoped Skill visibility and version ownership before expanding usage.</span>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 text-primary" />
              <span>Check audit and access settings to make sure governance surfaces match the current environment.</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Access</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {quickAccessItems.map((item) => (
              <Button key={item.href} variant="outline" asChild>
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
