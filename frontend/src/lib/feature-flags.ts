// 功能开关配置
// 基于环境变量控制功能启用/禁用

export const featureFlags = {
  // 公开注册开关
  enablePublicSignup: process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP === "true",

  // SSO 登录开关
  enableSSO: process.env.NEXT_PUBLIC_ENABLE_SSO === "true",

  // LDAP 登录开关
  enableLDAP: process.env.NEXT_PUBLIC_ENABLE_LDAP === "true",

  // 审计日志开关
  enableAuditLog: process.env.NEXT_PUBLIC_ENABLE_AUDIT_LOG === "true",

  // 组织模型开关 (企业/团队功能)
  enableOrgModel: process.env.NEXT_PUBLIC_ENABLE_ORG_MODEL === "true",

  // 邮箱验证码登录开关
  enableEmailOtpLogin: process.env.NEXT_PUBLIC_ENABLE_EMAIL_OTP_LOGIN !== "false", // 默认开启

  // RBAC 权限控制开关
  enableRBAC: process.env.NEXT_PUBLIC_ENABLE_RBAC !== "false", // 默认开启

  // Skill 可见性控制开关
  enableSkillVisibility: process.env.NEXT_PUBLIC_ENABLE_SKILL_VISIBILITY === "true",

  // 审计日志导出开关
  enableAuditExport: process.env.NEXT_PUBLIC_ENABLE_AUDIT_EXPORT === "true"
}

// 导出单个开关便于使用
export const {
  enablePublicSignup,
  enableSSO,
  enableLDAP,
  enableAuditLog,
  enableOrgModel,
  enableEmailOtpLogin,
  enableRBAC,
  enableSkillVisibility,
  enableAuditExport
} = featureFlags

// 默认导出
export default featureFlags
