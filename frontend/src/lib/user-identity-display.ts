import type { AppDictionary } from "@/i18n/messages/types"
import type { UserStatus } from "@/lib/user-status"

type IdentityBadgeVariant = "default" | "secondary" | "destructive" | "outline"

type UserIdentityLabels = Pick<
  AppDictionary["usersAdmin"],
  "roleAdmin" | "roleMember" | "roleViewer" | "statusActive" | "statusInactive" | "statusPending"
>

export const USER_STATUS_BADGE_VARIANTS: Record<UserStatus, IdentityBadgeVariant> = {
  active: "default",
  inactive: "destructive",
  pending: "secondary",
}

export function getUserRoleBadgeVariant(role: string): IdentityBadgeVariant {
  if (role === "admin") {
    return "default"
  }
  if (role === "member") {
    return "secondary"
  }
  return "outline"
}

export function getUserRoleLabel(role: string, labels: UserIdentityLabels): string {
  if (role === "admin") {
    return labels.roleAdmin
  }
  if (role === "member") {
    return labels.roleMember
  }
  if (role === "viewer") {
    return labels.roleViewer
  }
  return role
}

export function getUserStatusLabel(status: UserStatus, labels: UserIdentityLabels): string {
  if (status === "active") {
    return labels.statusActive
  }
  if (status === "inactive") {
    return labels.statusInactive
  }
  return labels.statusPending
}
