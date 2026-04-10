import { getAppMode, isNoRbacMode, isRbacMode } from "@/lib/app-mode"

export const featureFlags = {
  appMode: getAppMode(),
  enablePublicSignup: process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP === "true",
  enableSSO: process.env.NEXT_PUBLIC_ENABLE_SSO === "true",
  enableLDAP: process.env.NEXT_PUBLIC_ENABLE_LDAP === "true",
  enableAuditLog: process.env.NEXT_PUBLIC_ENABLE_AUDIT_LOG === "true",
  enableOrgModel: process.env.NEXT_PUBLIC_ENABLE_ORG_MODEL === "true",
  enableEmailOtpLogin: process.env.NEXT_PUBLIC_ENABLE_EMAIL_OTP_LOGIN !== "false",
  enableSkillVisibility: process.env.NEXT_PUBLIC_ENABLE_SKILL_VISIBILITY === "true",
  enableAuditExport: process.env.NEXT_PUBLIC_ENABLE_AUDIT_EXPORT === "true",
  isNoRbacMode: isNoRbacMode(),
  isRbacMode: isRbacMode(),
}

export const {
  appMode,
  enablePublicSignup,
  enableSSO,
  enableLDAP,
  enableAuditLog,
  enableOrgModel,
  enableEmailOtpLogin,
  enableSkillVisibility,
  enableAuditExport,
  isNoRbacMode: isNoRbacModeFlag,
  isRbacMode: isRbacModeFlag,
} = featureFlags

export default featureFlags
