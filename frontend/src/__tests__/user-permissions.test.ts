import { describe, expect, it } from "vitest"

import { defaultRuntimeCapabilities, type RuntimeCapabilities } from "@/lib/runtime-config"
import {
  canExportAuditLogs,
  canManageUsers,
  canUsePublicSkillCatalog,
  canUseSkillVisibilityControls,
  canViewAuditLogs,
  isPlatformAdmin,
} from "@/lib/user-permissions"
import type { User } from "@/types"

const activeAdmin = makeUser({ role: "admin" })
const activeSuperuser = makeUser({ is_superuser: true, role: "member" })
const activeMember = makeUser({ role: "member" })
const inactiveAdmin = makeUser({ is_active: false, role: "admin" })

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "user@example.test",
    username: "skill-user",
    is_active: true,
    is_superuser: false,
    enterprise_id: null,
    team_id: null,
    role: "member",
    status: "active",
    created_at: "2026-05-05T00:00:00Z",
    updated_at: "2026-05-05T00:00:00Z",
    ...overrides,
  }
}

function capabilities(overrides: Partial<RuntimeCapabilities> = {}): RuntimeCapabilities {
  return {
    ...defaultRuntimeCapabilities,
    ...overrides,
  }
}

describe("user permissions", () => {
  it("treats active admins and superusers as platform admins", () => {
    expect(isPlatformAdmin(activeAdmin)).toBe(true)
    expect(isPlatformAdmin(activeSuperuser)).toBe(true)
    expect(isPlatformAdmin(activeMember)).toBe(false)
    expect(isPlatformAdmin(inactiveAdmin)).toBe(false)
    expect(isPlatformAdmin(null)).toBe(false)
  })

  it("requires RBAC and platform admin identity to manage users", () => {
    expect(canManageUsers(activeAdmin, capabilities({ rbac: true, no_rbac_mode: false }))).toBe(true)
    expect(canManageUsers(activeSuperuser, capabilities({ rbac: true, no_rbac_mode: false }))).toBe(true)
    expect(canManageUsers(activeMember, capabilities({ rbac: true, no_rbac_mode: false }))).toBe(false)
    expect(canManageUsers(activeAdmin, capabilities({ rbac: false, no_rbac_mode: true }))).toBe(false)
  })

  it("requires audit capability, RBAC, and platform admin identity to view audit logs", () => {
    const auditEnabled = capabilities({ rbac: true, no_rbac_mode: false, audit_log: true })

    expect(canViewAuditLogs(activeAdmin, auditEnabled)).toBe(true)
    expect(canViewAuditLogs(activeMember, auditEnabled)).toBe(false)
    expect(canViewAuditLogs(activeAdmin, capabilities({ rbac: true, no_rbac_mode: false, audit_log: false }))).toBe(false)
    expect(canViewAuditLogs(activeAdmin, capabilities({ rbac: false, no_rbac_mode: true, audit_log: true }))).toBe(false)
  })

  it("requires audit export capability in addition to audit log access", () => {
    expect(
      canExportAuditLogs(activeAdmin, capabilities({ rbac: true, no_rbac_mode: false, audit_log: true, audit_export: true }))
    ).toBe(true)
    expect(
      canExportAuditLogs(activeAdmin, capabilities({ rbac: true, no_rbac_mode: false, audit_log: true, audit_export: false }))
    ).toBe(false)
    expect(
      canExportAuditLogs(activeMember, capabilities({ rbac: true, no_rbac_mode: false, audit_log: true, audit_export: true }))
    ).toBe(false)
  })

  it("keeps public skill catalog access tied to active users and the public catalog capability", () => {
    expect(canUsePublicSkillCatalog(activeMember, capabilities({ public_skills: true }))).toBe(true)
    expect(canUsePublicSkillCatalog(inactiveAdmin, capabilities({ public_skills: true }))).toBe(false)
    expect(canUsePublicSkillCatalog(activeMember, capabilities({ public_skills: false }))).toBe(false)
    expect(canUsePublicSkillCatalog(null, capabilities({ public_skills: true }))).toBe(false)
  })

  it("keeps skill visibility controls tied to active users and the visibility capability", () => {
    expect(canUseSkillVisibilityControls(activeMember, capabilities({ skill_visibility: true }))).toBe(true)
    expect(canUseSkillVisibilityControls(inactiveAdmin, capabilities({ skill_visibility: true }))).toBe(false)
    expect(canUseSkillVisibilityControls(activeMember, capabilities({ skill_visibility: false }))).toBe(false)
    expect(canUseSkillVisibilityControls(null, capabilities({ skill_visibility: true }))).toBe(false)
  })
})
