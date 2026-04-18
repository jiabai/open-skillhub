"use client"

import type { ReactNode } from "react"
import { Building2, Loader2, ShieldCheck, Users, UserRoundCog } from "lucide-react"

import type { AppDictionary } from "@/i18n/messages/types"
import type { RuntimeCapabilities } from "@/lib/runtime-config"
import {
  getUserRoleBadgeVariant,
  getUserRoleLabel,
  getUserStatusLabel,
  USER_STATUS_BADGE_VARIANTS,
} from "@/lib/user-identity-display"
import type { User } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type UserIdentitySummaryProps = {
  user: User | null
  isLoading: boolean
  capabilities: RuntimeCapabilities
  profile: AppDictionary["profile"]
  usersAdmin: AppDictionary["usersAdmin"]
}

type SummaryPanelProps = {
  label: string
  children: ReactNode
  icon: ReactNode
}

function SummaryPanel({ label, children, icon }: SummaryPanelProps) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

type OrgMembershipPanelProps = {
  label: string
  summary: string
  idValue: string | null
  icon: ReactNode
}

function OrgMembershipPanel({ label, summary, idValue, icon }: OrgMembershipPanelProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-medium">{summary}</p>
          {idValue ? (
            <Badge variant="secondary" className="w-fit font-mono">
              {idValue}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function UserIdentitySummary({
  user,
  isLoading,
  capabilities,
  profile,
  usersAdmin,
}: UserIdentitySummaryProps) {
  if (isLoading || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{profile.identityTitle}</CardTitle>
          <CardDescription>{profile.identityDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {profile.loading}
          </div>
        </CardContent>
      </Card>
    )
  }

  const showRole = capabilities.rbac || user.is_superuser || user.role !== "member"
  const showOrganization = capabilities.org_model

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.identityTitle}</CardTitle>
        <CardDescription>{profile.identityDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryPanel label={profile.platformIdentityLabel} icon={<ShieldCheck className="h-4 w-4" />}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={user.is_superuser ? "default" : "secondary"}>
                {user.is_superuser ? profile.platformIdentityAdmin : profile.platformIdentityUser}
              </Badge>
              {user.is_superuser ? <Badge variant="outline">{usersAdmin.superuser}</Badge> : null}
            </div>
          </SummaryPanel>

          <SummaryPanel label={profile.accountStatusLabel} icon={<UserRoundCog className="h-4 w-4" />}>
            <Badge variant={USER_STATUS_BADGE_VARIANTS[user.status]}>
              {getUserStatusLabel(user.status, usersAdmin)}
            </Badge>
          </SummaryPanel>

          {showRole ? (
            <SummaryPanel label={profile.workspaceRoleLabel} icon={<Users className="h-4 w-4" />}>
              <Badge variant={getUserRoleBadgeVariant(user.role)}>{getUserRoleLabel(user.role, usersAdmin)}</Badge>
            </SummaryPanel>
          ) : null}
        </div>

        {showOrganization ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-medium">{profile.orgInfoTitle}</p>
              <p className="text-sm text-muted-foreground">{profile.orgInfoDescription}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <OrgMembershipPanel
                label={profile.enterpriseMembershipLabel}
                summary={user.enterprise_id ? profile.hasEnterprise : profile.noEnterprise}
                idValue={user.enterprise_id}
                icon={<Building2 className="h-4 w-4" />}
              />
              <OrgMembershipPanel
                label={profile.teamMembershipLabel}
                summary={user.team_id ? profile.hasTeam : profile.noTeam}
                idValue={user.team_id}
                icon={<Users className="h-4 w-4" />}
              />
            </div>
            {!user.enterprise_id && !user.team_id ? <p className="text-sm text-muted-foreground">{profile.contactAdmin}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
