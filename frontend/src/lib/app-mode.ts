export type AppMode = "no-rbac" | "rbac"

export function resolveAppMode(enableRbacValue = process.env.NEXT_PUBLIC_ENABLE_RBAC): AppMode {
  return enableRbacValue === "true" ? "rbac" : "no-rbac"
}

export function getAppMode(): AppMode {
  return resolveAppMode()
}

export function isNoRbacMode(mode: AppMode = getAppMode()): boolean {
  return mode === "no-rbac"
}

export function isRbacMode(mode: AppMode = getAppMode()): boolean {
  return mode === "rbac"
}
