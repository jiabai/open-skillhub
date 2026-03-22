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
  enableAuditLog: process.env.NEXT_PUBLIC_ENABLE_AUDIT_LOG !== "false", // 默认开启

  // 组织模型开关 (企业/团队功能)
  enableOrgModel: process.env.NEXT_PUBLIC_ENABLE_ORG_MODEL === "true"
}

// 导出单个开关便于使用
export const {
  enablePublicSignup,
  enableSSO,
  enableLDAP,
  enableAuditLog,
  enableOrgModel
} = featureFlags

// 默认导出
export default featureFlags
