import { describe, expect, it } from "vitest"

import { isNoRbacMode, isRbacMode, resolveAppMode } from "@/lib/app-mode"

describe("app mode helpers", () => {
  it("resolves rbac mode when NEXT_PUBLIC_ENABLE_RBAC is true", () => {
    expect(resolveAppMode("true")).toBe("rbac")
    expect(isRbacMode("rbac")).toBe(true)
    expect(isNoRbacMode("rbac")).toBe(false)
  })

  it("resolves no-rbac mode when NEXT_PUBLIC_ENABLE_RBAC is false", () => {
    expect(resolveAppMode("false")).toBe("no-rbac")
    expect(isNoRbacMode("no-rbac")).toBe(true)
    expect(isRbacMode("no-rbac")).toBe(false)
  })

  it("defaults to no-rbac mode when NEXT_PUBLIC_ENABLE_RBAC is unset", () => {
    expect(resolveAppMode(undefined)).toBe("no-rbac")
  })
})
