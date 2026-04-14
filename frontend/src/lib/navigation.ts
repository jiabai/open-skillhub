import type { LucideIcon } from "lucide-react"
import { KeyRound, LayoutGrid, ScrollText, ShieldCheck, Sparkles, User2, Users } from "lucide-react"

import type { AppDictionary } from "@/i18n/messages/types"

export type NavigationItem = {
  href: string
  label: string
  icon: LucideIcon
}

type NavigationOptions = {
  rbacEnabled: boolean
  canManageUsers: boolean
  enableAuditLog: boolean
  labels: AppDictionary["navigation"]
}

export function getPrimaryNavigation(options: NavigationOptions): NavigationItem[] {
  const { labels } = options

  if (!options.rbacEnabled) {
    return [
      { href: "/dashboard", label: labels.workspace, icon: LayoutGrid },
      { href: "/public-skills", label: labels.publicSkills, icon: Sparkles },
      { href: "/skills", label: labels.mySkills, icon: Sparkles },
      { href: "/tokens", label: labels.tokens, icon: KeyRound },
      { href: "/profile", label: labels.profile, icon: User2 },
      { href: "/security", label: labels.security, icon: ShieldCheck },
    ]
  }

  return [
    { href: "/dashboard", label: labels.overview, icon: LayoutGrid },
    { href: "/skills", label: labels.skills, icon: Sparkles },
    { href: "/public-skills", label: labels.publicSkills, icon: Sparkles },
    { href: "/tokens", label: labels.tokens, icon: KeyRound },
    ...(options.enableAuditLog ? [{ href: "/audit", label: labels.audit, icon: ScrollText }] : []),
    ...(options.canManageUsers ? [{ href: "/admin/users", label: labels.users, icon: Users }] : []),
    { href: "/profile", label: labels.profile, icon: User2 },
    { href: "/security", label: labels.security, icon: ShieldCheck },
  ]
}
