import { apiBaseUrl } from "@/lib/api"

export type RuntimeCapabilities = {
  skill_visibility: boolean
  public_skills: boolean
  org_model: boolean
  public_signup: boolean
  email_otp_login: boolean
  sso: boolean
  ldap: boolean
  audit_log: boolean
  audit_export: boolean
  rbac: boolean
  no_rbac_mode: boolean
  desktop_release_url: string
  desktop_release_version: string
}

export type RuntimeConfig = {
  capabilities: RuntimeCapabilities
}

export type RuntimeConfigInput = {
  capabilities?: Partial<RuntimeCapabilities>
}

export const defaultRuntimeCapabilities: RuntimeCapabilities = {
  skill_visibility: false,
  public_skills: false,
  org_model: false,
  public_signup: false,
  email_otp_login: false,
  sso: false,
  ldap: false,
  audit_log: false,
  audit_export: false,
  rbac: false,
  no_rbac_mode: true,
  desktop_release_url: "",
  desktop_release_version: "",
}

export const defaultRuntimeConfig: RuntimeConfig = {
  capabilities: defaultRuntimeCapabilities,
}

let runtimeConfigSnapshot: RuntimeConfig = defaultRuntimeConfig
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function getRuntimeConfigSnapshot(): RuntimeConfig {
  return runtimeConfigSnapshot
}

export function getRuntimeCapabilitiesSnapshot(): RuntimeCapabilities {
  return runtimeConfigSnapshot.capabilities
}

export function subscribeRuntimeConfig(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setRuntimeConfigSnapshot(config: RuntimeConfig): void {
  runtimeConfigSnapshot = config
  notifyListeners()
}

function normalizeCapabilities(value: Partial<RuntimeCapabilities> | undefined): RuntimeCapabilities {
  return {
    ...defaultRuntimeCapabilities,
    ...value,
  }
}

export function normalizeRuntimeConfig(value: RuntimeConfigInput | undefined): RuntimeConfig {
  return {
    capabilities: normalizeCapabilities(value?.capabilities),
  }
}

export async function fetchRuntimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
  const response = await fetch(`${apiBaseUrl}/api/v1/runtime-config`, { signal, cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to load runtime config (${response.status})`)
  }
  const payload = (await response.json()) as RuntimeConfigInput
  return normalizeRuntimeConfig(payload)
}

export async function loadRuntimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
  try {
    const config = await fetchRuntimeConfig(signal)
    setRuntimeConfigSnapshot(config)
    return config
  } catch {
    setRuntimeConfigSnapshot(defaultRuntimeConfig)
    return defaultRuntimeConfig
  }
}

export function __setRuntimeConfigForTests(config: RuntimeConfigInput): void {
  setRuntimeConfigSnapshot(normalizeRuntimeConfig(config))
}

export function __resetRuntimeConfigForTests(): void {
  setRuntimeConfigSnapshot(defaultRuntimeConfig)
}
