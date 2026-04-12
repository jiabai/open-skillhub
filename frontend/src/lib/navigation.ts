import type { LucideIcon } from "lucide-react"
import { KeyRound, LayoutGrid, ScrollText, ShieldCheck, Sparkles, User2, Users } from "lucide-react"

export type NavigationItem = {
  href: string
  label: string
  icon: LucideIcon
}

type NavigationOptions = {
  rbacEnabled: boolean
  canManageUsers: boolean
  enableAuditLog: boolean
}

export function getPrimaryNavigation(options: NavigationOptions): NavigationItem[] {
  if (!options.rbacEnabled) {
    return [
      { href: "/dashboard", label: "Workspace", icon: LayoutGrid },
      { href: "/public-skills", label: "Public Skills", icon: Sparkles },
      { href: "/skills", label: "My Skills", icon: Sparkles },
      { href: "/tokens", label: "Tokens", icon: KeyRound },
      { href: "/profile", label: "Profile", icon: User2 },
      { href: "/security", label: "Security", icon: ShieldCheck },
    ]
  }

  return [
    { href: "/dashboard", label: "Overview", icon: LayoutGrid },
    { href: "/skills", label: "Skills", icon: Sparkles },
    { href: "/public-skills", label: "Public Skills", icon: Sparkles },
    { href: "/tokens", label: "Tokens", icon: KeyRound },
    ...(options.enableAuditLog ? [{ href: "/audit", label: "Audit", icon: ScrollText }] : []),
    ...(options.canManageUsers ? [{ href: "/admin/users", label: "Users", icon: Users }] : []),
    { href: "/profile", label: "Profile", icon: User2 },
    { href: "/security", label: "Security", icon: ShieldCheck },
  ]
}
