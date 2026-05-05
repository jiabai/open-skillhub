// Open SkillHub Frontend Type Definitions
// 参考文档：docs/frontend-design/01-api-types.md

import type { UserStatus } from "@/lib/user-status"
import type { SkillVisible, WritableSkillVisible } from "@/lib/skill-visibility"

// ========== 基础类型 ==========

export type TokenPair = {
  access_token: string
  refresh_token: string
}

export type { SkillVisible, WritableSkillVisible }
export type SkillKind = "regular" | "public" | "reference" | "clone"

// ========== 核心数据模型 ==========

export type ConsoleSkill = {
  id: string
  name: string
  description: string | null
  tags?: string[]
  visible?: SkillVisible
  source_skill_id?: string | null
  pinned_version?: string | null
  resolved_version?: string | null
  skill_kind?: SkillKind
  is_reference_read_only?: boolean
  current_version?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export type PublicSkill = {
  id: string
  name: string
  description: string | null
  tags?: string[]
  visible?: Extract<SkillVisible, "public">
  pinned_version?: string | null
  resolved_version?: string | null
  skill_kind?: Extract<SkillKind, "public">
  current_version?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
  has_reference?: boolean
  has_clone?: boolean
}

export type Token = {
  id: string
  user_id?: string
  name: string
  token?: string | null
  is_active: boolean
  expires_at?: string | null
  last_used_at?: string | null
  created_at: string
}

export type User = {
  id: string
  email: string
  username: string
  is_active: boolean
  is_superuser: boolean
  enterprise_id: string | null
  team_id: string | null
  role: string
  status: UserStatus
  created_at: string
  updated_at: string
}

export type UserIdentityUpdate = {
  enterprise_id?: string | null
  team_id?: string | null
  role?: string | null
  status?: UserStatus | null
}

// ========== 响应类型 ==========

export type DashboardOverview = {
  active_skills: number
  available_tokens: number
  success_rate: number | null
  success_rate_window_hours: number
  success_rate_total: number
}

export type VerificationCodeResponse = {
  sent: boolean
  expires_in?: number
  resend_interval?: number
  max_attempts?: number
  attempts_left?: number
}

export type MetricsCleanupResponse = {
  removed: number
  retention_days: number
  cutoff: string
}

export type MetricsReset24hResponse = {
  removed: number
  window_hours: number
  window_start: string
  window_end: string
}

// ========== Skill 版本相关类型 ==========

export type SkillVersion = {
  version: string
  description: string
  dependencies: string[]
  dependency_spec?: Record<string, any>
  dependency_spec_version?: string
  metadata: Record<string, any>
  created_at: string
}

export type SkillVersionDiff = {
  from_version: string
  to_version: string
  added: string[]
  removed: string[]
  modified: Array<{ path: string; diff: string }>
}

export type SkillInstallInstructions = {
  strategy: string
  dependencies: string[]
  requirements_text: string
  commands: string[]
  ecosystem?: string
  manifests?: Record<string, any>
  dependency_spec?: Record<string, any>
}

export type SkillDownloadResponse = {
  skill_uuid: string
  version: string
  encrypted_code: string
  checksum: string
  expires_at: string
  cache_ttl_seconds?: number
  archive_size_bytes: number
  encryption_enabled: boolean
  download_filename: string
  decryption_hint?: string | null
}

export type SkillCachePolicyResponse = {
  cache_ttl_seconds: number
  encryption_enabled: boolean
  download_encryption_enabled: boolean
}

// ========== 审计日志类型 ==========

export type AuditLogItem = {
  id: string
  actor_id: string
  action: string
  target: string
  result: string
  timestamp: string
  ip: string
  user_agent: string
  details: Record<string, any>
}

export type AuditLogExportRequest = {
  format: "json" | "csv"
  filters?: {
    actor_id?: string
    action?: string
    start?: string
    end?: string
  }
}

export type AuditLogExportResponse = {
  format: string
  content: string
}

export type AuditLogListResponse = {
  items: AuditLogItem[]
}

// ========== 错误响应类型 ==========

export type ErrorCode =
  | "CODE_EXPIRED"
  | "CODE_INVALID"
  | "CODE_MISMATCH"
  | "TOO_MANY_ATTEMPTS"
  | "RESEND_TOO_FREQUENT"
  | "EMAIL_ALREADY_EXISTS"
  | "USERNAME_ALREADY_EXISTS"
  | "REGISTRATION_DISABLED"
  | "LOGIN_DISABLED"
  | "ACCOUNT_DELETED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "PERMISSION_DENIED"
  | "RESOURCE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_SERVER_ERROR"
  | "SKILL_DEACTIVATED"

export type ApiErrorResponse = {
  detail: string
  code?: ErrorCode
}

// ========== 列表响应类型 ==========

export type SkillListResponse = {
  items: ConsoleSkill[]
  total: number
}

export type PublicSkillListResponse = {
  items: PublicSkill[]
  total: number
}

export type TokenListResponse = {
  items: Token[]
  total: number
}

export type SkillVersionListResponse = {
  items: SkillVersion[]
}

export type UserListResponse = {
  items: User[]
  total: number
}

// ========== 请求体类型 ==========

export type VerificationCodeRequest = {
  email: string
  purpose: "login" | "register" | "bind_email" | "delete_account"
}

export type RegisterRequest = {
  email: string
  username: string
  code: string
}

export type LoginRequest = {
  email: string
  code: string
}

export type TokenRefreshRequest = {
  refresh_token: string
}

export type UserUpdateRequest = {
  username?: string
  email?: string
}

export type PasswordChangeRequest = {
  current_password: string
  new_password: string
}

export type AccountDeleteRequest = {
  code: string
}

export type BindEmailRequest = {
  email: string
  code: string
}

export type SkillCreateRequest = {
  name: string
  description?: string | null
  tags?: string[]
  visible?: WritableSkillVisible
}

export type SkillUpdateRequest = {
  name?: string
  description?: string | null
  tags?: string[]
  visible?: WritableSkillVisible
}

export type PublicSkillReferenceRequest = {
  name: string
  pinned_version?: string | null
}

export type PublicSkillCloneRequest = {
  name: string
  visible?: WritableSkillVisible
}

export type TokenCreateRequest = {
  name: string
  expires_at?: string | null
}

export type SkillDownloadRequest = {
  skill_uuid: string
  version?: string
}

export type MetricsCleanupRequest = {
  retention_days?: number | null
}

export type AuditLogListParams = {
  actor_id?: string
  action?: string
  start?: string
  end?: string
  skip?: number
  limit?: number
}

// ========== 工具函数类型 ==========

export type ApiRequestOptions = RequestInit & {
  skipRefresh?: boolean
  accessToken?: string
}

export type FetchResult<T> = {
  response: Response
  payload: T
}
