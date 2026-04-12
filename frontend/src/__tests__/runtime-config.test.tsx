import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RuntimeConfigProvider } from "@/components/app/runtime-config-provider"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import { __resetRuntimeConfigForTests, getRuntimeCapabilitiesSnapshot } from "@/lib/runtime-config"

function Probe() {
  const { config, isLoading } = useRuntimeConfig()
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="rbac">{String(config.capabilities.rbac)}</span>
      <span data-testid="signup">{String(config.capabilities.public_signup)}</span>
    </div>
  )
}

describe("runtime config", () => {
  beforeEach(() => {
    __resetRuntimeConfigForTests()
    vi.restoreAllMocks()
  })

  it("loads runtime capabilities from the backend endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          capabilities: {
            skill_visibility: true,
            public_skills: false,
            org_model: true,
            public_signup: false,
            email_otp_login: true,
            sso: true,
            ldap: false,
            audit_log: true,
            audit_export: true,
            rbac: true,
            no_rbac_mode: false,
          },
        }),
      }))
    )

    render(
      <RuntimeConfigProvider>
        <Probe />
      </RuntimeConfigProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })
    expect(screen.getByTestId("rbac")).toHaveTextContent("true")
    expect(screen.getByTestId("signup")).toHaveTextContent("false")
    expect(getRuntimeCapabilitiesSnapshot().rbac).toBe(true)
  })

  it("falls back to closed business capabilities when loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })))

    render(
      <RuntimeConfigProvider>
        <Probe />
      </RuntimeConfigProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })
    expect(screen.getByTestId("rbac")).toHaveTextContent("false")
    expect(screen.getByTestId("signup")).toHaveTextContent("false")
    expect(getRuntimeCapabilitiesSnapshot().audit_log).toBe(false)
  })
})
