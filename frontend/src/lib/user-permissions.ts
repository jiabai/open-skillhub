import type { RuntimeCapabilities } from "@/lib/runtime-config"
import type { User } from "@/types"

type MaybeUser = User | null | undefined

function isActiveUser(user: MaybeUser): user is User {
  return Boolean(user?.is_active)
}

export function isPlatformAdmin(user: MaybeUser): boolean {
  return isActiveUser(user) && (user.is_superuser || user.role === "admin")
}

export function canManageUsers(user: MaybeUser, capabilities: RuntimeCapabilities): boolean {
  return capabilities.rbac && isPlatformAdmin(user)
}

export function canViewAuditLogs(user: MaybeUser, capabilities: RuntimeCapabilities): boolean {
  return capabilities.rbac && capabilities.audit_log && isPlatformAdmin(user)
}

export function canExportAuditLogs(user: MaybeUser, capabilities: RuntimeCapabilities): boolean {
  return capabilities.audit_export && canViewAuditLogs(user, capabilities)
}

export function canUsePublicSkillCatalog(user: MaybeUser, capabilities: RuntimeCapabilities): boolean {
  return isActiveUser(user) && capabilities.public_skills
}

export function canUseSkillVisibilityControls(user: MaybeUser, capabilities: RuntimeCapabilities): boolean {
  return isActiveUser(user) && capabilities.skill_visibility
}
