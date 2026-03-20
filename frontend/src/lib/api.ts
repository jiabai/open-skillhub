export type TokenPair = {
  access_token: string
  refresh_token: string
}

export type AccessTokenResponse = {
  access_token: string
}

export type Skill = {
  id: string
  name: string
  description: string | null
  tags?: string[]
  created_at?: string
  updated_at?: string
}

export type Token = {
  id: string
  name: string
  token?: string | null
  created_at?: string
  expires_at?: string | null
  revoked_at?: string | null
}

export type User = {
  id?: string
  email: string
  username: string
  is_superuser?: boolean
}

export type DashboardOverview = {
  active_skills: number
  available_tokens: number
  success_rate: number | null
  success_rate_window_hours: number
  success_rate_total: number
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

export type VerificationCodeResponse = {
  sent: boolean
  expires_in?: number
  resend_interval?: number
  max_attempts?: number
  attempts_left?: number
}

const storageKey = "skillhub.tokens"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

export function getStoredTokens(): TokenPair | null {
  if (typeof window === "undefined") {
    return null
  }
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as TokenPair
  } catch {
    return null
  }
}

export function storeTokens(tokens: TokenPair) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(storageKey, JSON.stringify(tokens))
}

export function clearTokens() {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.removeItem(storageKey)
}

type ApiRequestOptions = RequestInit & {
  skipRefresh?: boolean
  accessToken?: string
}

type ApiResponse = {
  response: Response
  payload: unknown
}

type TextResponse = {
  response: Response
  text: string
}

const getDetail = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: string }).detail
    if (detail) {
      return detail
    }
  }
  return fallback
}

const getDetailFromText = (text: string, fallback: string) => {
  if (!text) {
    return fallback
  }
  try {
    const payload = JSON.parse(text) as unknown
    return getDetail(payload, fallback)
  } catch {
    return fallback
  }
}

const fetchJson = async (path: string, options: ApiRequestOptions = {}): Promise<ApiResponse> => {
  const { skipRefresh: _skipRefresh, accessToken, ...requestOptions } = options
  const tokens = getStoredTokens()
  const headers = new Headers(requestOptions.headers)
  headers.set("Content-Type", "application/json")
  const resolvedToken = accessToken ?? tokens?.access_token
  if (resolvedToken) {
    headers.set("Authorization", `Bearer ${resolvedToken}`)
  }
  const response = await fetch(`${apiBaseUrl}${path}`, { ...requestOptions, headers })
  if (response.status === 204) {
    return { response, payload: {} }
  }
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

const fetchText = async (path: string, options: ApiRequestOptions = {}): Promise<TextResponse> => {
  const { skipRefresh: _skipRefresh, accessToken, ...requestOptions } = options
  const tokens = getStoredTokens()
  const headers = new Headers(requestOptions.headers)
  const resolvedToken = accessToken ?? tokens?.access_token
  if (resolvedToken) {
    headers.set("Authorization", `Bearer ${resolvedToken}`)
  }
  const response = await fetch(`${apiBaseUrl}${path}`, { ...requestOptions, headers })
  const text = await response.text().catch(() => "")
  return { response, text }
}

const refreshTokens = async (refreshToken: string): Promise<AccessTokenResponse> => {
  const { response, payload } = await fetchJson("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
    accessToken: "",
    skipRefresh: true
  })
  if (!response.ok) {
    throw new Error(getDetail(payload, response.statusText))
  }
  return payload as AccessTokenResponse
}

async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { response, payload } = await fetchJson(path, options)
  if (response.ok) {
    return payload as T
  }
  if (response.status === 401 && !options.skipRefresh) {
    const tokens = getStoredTokens()
    if (tokens?.refresh_token) {
      try {
        const refreshed = await refreshTokens(tokens.refresh_token)
        storeTokens({ access_token: refreshed.access_token, refresh_token: tokens.refresh_token })
        const retry = await fetchJson(path, { ...options, accessToken: refreshed.access_token, skipRefresh: true })
        if (retry.response.ok) {
          return retry.payload as T
        }
        throw new Error(getDetail(retry.payload, retry.response.statusText))
      } catch (error) {
        clearTokens()
        throw error
      }
    }
  }
  throw new Error(getDetail(payload, response.statusText))
}

async function apiFetchText(path: string, options: ApiRequestOptions = {}): Promise<string> {
  const { response, text } = await fetchText(path, options)
  if (response.ok) {
    return text
  }
  if (response.status === 401 && !options.skipRefresh) {
    const tokens = getStoredTokens()
    if (tokens?.refresh_token) {
      try {
        const refreshed = await refreshTokens(tokens.refresh_token)
        storeTokens({ access_token: refreshed.access_token, refresh_token: tokens.refresh_token })
        const retry = await fetchText(path, { ...options, accessToken: refreshed.access_token, skipRefresh: true })
        if (retry.response.ok) {
          return retry.text
        }
        throw new Error(getDetailFromText(retry.text, retry.response.statusText))
      } catch (error) {
        clearTokens()
        throw error
      }
    }
  }
  throw new Error(getDetailFromText(text, response.statusText))
}

export const api = {
  sendVerificationCode: (payload: { email: string; purpose: "login" | "register" | "bind_email" }) =>
    apiFetch<VerificationCodeResponse>("/api/v1/auth/verification-code", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  register: (payload: { email: string; username: string; code: string }) =>
    apiFetch("/api/v1/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; code: string }) =>
    apiFetch<TokenPair>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  refresh: (payload: { refresh_token: string }) =>
    apiFetch<AccessTokenResponse>("/api/v1/auth/refresh", { method: "POST", body: JSON.stringify(payload) }),
  getMe: () => apiFetch<User>("/api/v1/users/me"),
  getDashboardOverview: () => apiFetch<DashboardOverview>("/api/v1/dashboard/overview"),
  cleanupMetrics: (payload?: { retention_days?: number | null }) =>
    apiFetch<MetricsCleanupResponse>("/api/v1/dashboard/metrics/cleanup", {
      method: "POST",
      body: JSON.stringify(payload ?? {})
    }),
  resetMetrics24h: () =>
    apiFetch<MetricsReset24hResponse>("/api/v1/dashboard/metrics/reset-24h", {
      method: "POST",
      body: JSON.stringify({})
    }),
  updateMe: (payload: { username?: string; email?: string }) =>
    apiFetch("/api/v1/users/me", { method: "PUT", body: JSON.stringify(payload) }),
  changePassword: (payload: { current_password: string; new_password: string }) =>
    apiFetch("/api/v1/users/me/password", { method: "PUT", body: JSON.stringify(payload) }),
  deleteAccount: (payload: { password: string }) =>
    apiFetch("/api/v1/users/me", { method: "DELETE", body: JSON.stringify(payload) }),
  listSkills: (query?: string) =>
    apiFetch<{ items: Skill[]; total: number }>(`/api/v1/skills${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  createSkill: (payload: { name: string; description?: string | null; tags?: string[] }) =>
    apiFetch<Skill>("/api/v1/skills", { method: "POST", body: JSON.stringify(payload) }),
  getSkill: (skillUuid: string) => apiFetch<Skill>(`/api/v1/skills/${skillUuid}`),
  updateSkill: (skillUuid: string, payload: { name?: string; description?: string | null; tags?: string[] }) =>
    apiFetch<Skill>(`/api/v1/skills/${skillUuid}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSkill: (skillUuid: string) => apiFetch(`/api/v1/skills/${skillUuid}`, { method: "DELETE" }),
  listSkillFiles: (skillUuid: string) => apiFetch<string[]>(`/api/v1/skills/${skillUuid}/files`),
  getSkillFileContent: (skillUuid: string, filePath: string) =>
    apiFetchText(`/api/v1/skills/${skillUuid}/files/${encodeURIComponent(filePath)}`),
  uploadSkillFile: async (skillUuid: string, file: File) => {
    const tokens = getStoredTokens()
    const formData = new FormData()
    formData.append("skill_uuid", skillUuid)
    formData.append("file", file)
    const response = await fetch(`${apiBaseUrl}/api/v1/skills/upload`, {
      method: "POST",
      body: formData,
      headers: tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : undefined
    })
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      const detail = errorPayload.detail || response.statusText
      throw new Error(detail)
    }
    return (await response.json()) as { filename: string }
  },
  listTokens: () => apiFetch<{ items: Token[]; total: number }>("/api/v1/tokens"),
  createToken: (payload: { name: string; expires_at?: string | null }) =>
    apiFetch<Token>("/api/v1/tokens", { method: "POST", body: JSON.stringify(payload) }),
  revokeToken: (tokenId: string) => apiFetch(`/api/v1/tokens/${tokenId}`, { method: "DELETE" })
}
