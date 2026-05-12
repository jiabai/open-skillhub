"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Database, KeyRound, Shield, Sparkles, UploadCloud } from "lucide-react"

import { NextStepCard } from "@/components/app/next-step-card"
import { PageIntro } from "@/components/app/page-intro"
import { WorkspaceBoundaryNote } from "@/components/app/workspace-boundary-note"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import { getPrimaryNavigation } from "@/lib/navigation"
import { canManageUsers, canViewAuditLogs } from "@/lib/user-permissions"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"
import type { DashboardOverview, SkillCachePolicyResponse, User } from "@/types"

export default function DashboardPage() {
  const { config } = useRuntimeConfig()
  const { dictionary } = useI18n()
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [cachePolicy, setCachePolicy] = useState<SkillCachePolicyResponse | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const rbacEnabled = config.capabilities.rbac
  const dashboardCopy = dictionary.dashboard
  const navigationLabels = dictionary.navigation

  useEffect(() => {
    const load = async () => {
      setStatus("loading")
      setError(null)
      try {
        const [overviewData, cachePolicyData, currentUser] = await Promise.all([
          api.getDashboardOverview(),
          api.getSkillCachePolicy().catch(() => null),
          rbacEnabled ? api.getMe().catch(() => null) : Promise.resolve(null),
        ])
        setOverview(overviewData)
        setCachePolicy(cachePolicyData)
        setCurrentUser(currentUser)
        setStatus("ready")
      } catch (err) {
        setStatus("error")
        setError(err instanceof Error ? err.message : dashboardCopy.errors.loadFailed)
      }
    }

    load()
  }, [dashboardCopy.errors.loadFailed, rbacEnabled])

  const quickAccessItems = useMemo(
    () =>
      getPrimaryNavigation({
        rbacEnabled,
        canManageUsers: canManageUsers(currentUser, config.capabilities),
        enableAuditLog: canViewAuditLogs(currentUser, config.capabilities),
        labels: navigationLabels,
      }).filter((item) => ["/skills", "/public-skills", "/tokens", "/audit", "/admin/users"].includes(item.href)),
    [rbacEnabled, currentUser, config.capabilities, navigationLabels]
  )

  if (!rbacEnabled) {
    const noRbacCopy = dashboardCopy.noRbac

    return (
      <div className="flex flex-col gap-6">
        <PageIntro
          title={noRbacCopy.title}
          summary={noRbacCopy.summary}
        />
        <WorkspaceBoundaryNote rbacEnabled={rbacEnabled} />

        {status === "error" ? (
          <Card className="border-destructive/50">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{noRbacCopy.startHereTitle}</h2>
            <p className="text-sm text-muted-foreground">{noRbacCopy.startHereSummary}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NextStepCard
              title={noRbacCopy.browsePublicSkillsTitle}
              description={noRbacCopy.browsePublicSkillsDescription}
              href="/public-skills"
              actionLabel={noRbacCopy.browsePublicSkillsAction}
            />
            <NextStepCard
              title={noRbacCopy.uploadSkillTitle}
              description={noRbacCopy.uploadSkillDescription}
              href="/skills/new"
              actionLabel={noRbacCopy.uploadSkillAction}
            />
            <NextStepCard
              title={noRbacCopy.createTokenTitle}
              description={noRbacCopy.createTokenDescription}
              href="/tokens"
              actionLabel={noRbacCopy.createTokenAction}
            />
            <NextStepCard
              title={noRbacCopy.desktopClientTitle}
              description={noRbacCopy.desktopClientDescription}
              href={config.capabilities.desktop_release_url}
              actionLabel={noRbacCopy.desktopClientAction}
              external
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{noRbacCopy.snapshotTitle}</h2>
            <p className="text-sm text-muted-foreground">{noRbacCopy.snapshotSummary}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{noRbacCopy.mySkills}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{overview?.active_skills ?? "—"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{noRbacCopy.myTokens}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{overview?.available_tokens ?? "—"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{noRbacCopy.cacheAccess}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {cachePolicy
                    ? formatMessage(noRbacCopy.cacheTtl, { minutes: Math.floor(cachePolicy.cache_ttl_seconds / 60) })
                    : noRbacCopy.runtimePolicyUnavailable}
                </div>
                <div className="text-sm text-muted-foreground">
                  {cachePolicy?.download_encryption_enabled ? noRbacCopy.downloadEncryptionEnabled : noRbacCopy.downloadEncryptionDisabled}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{noRbacCopy.needToKnowTitle}</h2>
            <p className="text-sm text-muted-foreground">{noRbacCopy.needToKnowSummary}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {noRbacCopy.publicSkillsTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {noRbacCopy.publicSkillsText}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UploadCloud className="h-4 w-4 text-primary" />
                  {noRbacCopy.referenceVsCloneTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {noRbacCopy.referenceVsCloneText}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-4 w-4 text-primary" />
                  {noRbacCopy.tokenAccessTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {noRbacCopy.tokenAccessText}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    )
  }

  const rbacCopy = dashboardCopy.rbac

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title={rbacCopy.title}
        summary={rbacCopy.summary}
        actions={
          <Button asChild>
            <Link href="/skills">
              {rbacCopy.openSkills}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <WorkspaceBoundaryNote rbacEnabled={rbacEnabled} />

      {status === "error" ? (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{rbacCopy.teamOrgOverview}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {overview
              ? formatMessage(rbacCopy.activeSkillsInScope, { count: overview.active_skills })
              : rbacCopy.loadingScopeOverview}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{rbacCopy.skillGovernance}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {rbacCopy.skillGovernanceText}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{rbacCopy.auditAccess}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {cachePolicy?.download_encryption_enabled ? rbacCopy.encryptedDownloadsActive : rbacCopy.reviewAuditControls}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{rbacCopy.pendingActions}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 text-primary" />
              <span>{rbacCopy.pendingVisibilityAction}</span>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 text-primary" />
              <span>{rbacCopy.pendingAuditAction}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{rbacCopy.quickAccess}</CardTitle>
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
