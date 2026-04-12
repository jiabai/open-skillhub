import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, vi } from "vitest"

import { RuntimeConfigContext } from "@/components/app/runtime-config-provider"
import DashboardPage from "@/app/dashboard/page"
import LoginPage from "@/app/login/page"
import ProfilePage from "@/app/profile/page"
import PublicSkillsPage from "@/app/public-skills/page"
import RegisterPage from "@/app/register/page"
import SecurityPage from "@/app/security/page"
import SkillDetailPage from "@/app/skills/[skillUuid]/page"
import SkillsPage from "@/app/skills/page"
import TokensPage from "@/app/tokens/page"
import { api } from "@/lib/api"
import { __setRuntimeConfigForTests, getRuntimeConfigSnapshot } from "@/lib/runtime-config"

const replaceMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/",
}))

const publicSkillsPayload = {
  items: [
    {
      id: "public-1",
      user_id: "system",
      name: "Starter Skill",
      description: "Public starter",
      tags: ["starter"],
      visible: "public",
      current_version: "1.2.3",
      resolved_version: "1.2.3",
      skill_kind: "public",
      is_reference_read_only: false,
      has_reference: false,
      has_clone: false,
      is_active: true,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    },
  ],
  total: 1,
} as any

function renderWithRuntimeConfig(node: React.ReactNode) {
  return render(
    <RuntimeConfigContext.Provider value={{ config: getRuntimeConfigSnapshot(), isLoading: false }}>
      {node}
    </RuntimeConfigContext.Provider>
  )
}

async function activateTab(name: string) {
  const tab = screen.getByRole("tab", { name })
  await act(async () => {
    tab.focus()
    fireEvent.keyDown(tab, { key: "Enter", code: "Enter" })
  })
  await waitFor(() => {
    expect(tab).toHaveAttribute("aria-selected", "true")
  })
}

describe("console pages", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __setRuntimeConfigForTests({
      capabilities: {
        skill_visibility: true,
        public_skills: false,
        org_model: true,
        public_signup: true,
        email_otp_login: true,
        sso: false,
        ldap: false,
        audit_log: true,
        audit_export: true,
        rbac: false,
        no_rbac_mode: true,
      },
    })
  })

  it("renders login form", () => {
    renderWithRuntimeConfig(<LoginPage />)
    expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(1)
  })

  it("redirects after login success", async () => {
    replaceMock.mockClear()
    renderWithRuntimeConfig(<LoginPage />)
    const fields = screen.getAllByRole("textbox")
    fireEvent.change(fields[0], { target: { value: "user@example.com" } })
    fireEvent.change(fields[1], { target: { value: "123456" } })
    const submitButton = screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit")
    expect(submitButton).toBeTruthy()
    fireEvent.click(submitButton!)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard")
    })
  })

  it("renders register form", () => {
    renderWithRuntimeConfig(<RegisterPage />)
    expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(1)
  })

  it("redirects to login after register success", async () => {
    replaceMock.mockClear()
    vi.useFakeTimers()
    await act(async () => {
      renderWithRuntimeConfig(<RegisterPage />)
    })
    const fields = screen.getAllByRole("textbox")
    fireEvent.change(fields[0], { target: { value: "demo" } })
    fireEvent.change(fields[1], { target: { value: "demo@example.com" } })
    fireEvent.change(fields[2], { target: { value: "123456" } })
    const submitButton = screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit")
    expect(submitButton).toBeTruthy()
    await act(async () => {
      fireEvent.click(submitButton!)
      await Promise.resolve()
    })
    expect(api.register).toHaveBeenCalled()
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(replaceMock).toHaveBeenCalledWith("/login")
    vi.useRealTimers()
  })

  it("renders no-rbac dashboard overview", async () => {
    renderWithRuntimeConfig(<DashboardPage />)
    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeInTheDocument()
    expect(await screen.findByText("Start Here")).toBeInTheDocument()
    expect(await screen.findByText("My Workspace Snapshot")).toBeInTheDocument()
    expect(await screen.findByText("Need To Know")).toBeInTheDocument()
  })

  it("renders rbac dashboard overview", async () => {
    __setRuntimeConfigForTests({
      capabilities: {
        rbac: true,
        no_rbac_mode: false,
        audit_log: true,
      },
    })
    renderWithRuntimeConfig(<DashboardPage />)
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(await screen.findByText("Team / Org Overview")).toBeInTheDocument()
    expect(await screen.findByText("Skill Governance")).toBeInTheDocument()
    expect(await screen.findByText("Audit & Access")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Audit" })).toBeInTheDocument()
  })

  it("renders skills list with personal workspace framing", async () => {
    vi.mocked(api.listSkills).mockResolvedValueOnce({
      items: [
        {
          id: "ref-1",
          user_id: "user-1",
          name: "Starter Skill Ref",
          description: "Public starter",
          source_skill_id: "public-1",
          pinned_version: null,
          resolved_version: "1.2.3",
          skill_kind: "reference",
          is_reference_read_only: true,
          is_active: true,
        },
      ],
      total: 1,
    } as any)

    renderWithRuntimeConfig(<SkillsPage />)
    expect(await screen.findByRole("heading", { name: "My Skills" })).toBeInTheDocument()
    expect(await screen.findByText("Reference - follows public source")).toBeInTheDocument()
  })

  it("renders public skills list with no-rbac explainer", async () => {
    vi.mocked(api.listPublicSkills).mockResolvedValueOnce(publicSkillsPayload)

    renderWithRuntimeConfig(<PublicSkillsPage />)
    expect(await screen.findByRole("heading", { name: "Public Skills" })).toBeInTheDocument()
    expect(
      await screen.findByText("Best when you want to start using a public Skill quickly without taking over its files.")
    ).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Clone" })).toBeInTheDocument()
    expect(await screen.findByText("Recommended first step: Reference")).toBeInTheDocument()
  })

  it("triggers public skill actions and shows next steps", async () => {
    vi.mocked(api.listPublicSkills).mockResolvedValue(publicSkillsPayload)
    vi.mocked(api.clonePublicSkill).mockResolvedValueOnce({ id: "clone-1", name: "Starter Skill-copy" } as any)

    renderWithRuntimeConfig(<PublicSkillsPage />)
    await screen.findByText("Starter Skill")

    fireEvent.click(screen.getByRole("button", { name: "Add Reference" }))
    await waitFor(() => {
      expect(api.referencePublicSkill).toHaveBeenCalledWith("public-1", { name: "Starter Skill" })
    })
    expect(await screen.findByText("Reference created")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clone" }))
    await waitFor(() => {
      expect(api.clonePublicSkill).toHaveBeenCalledWith("public-1", { name: "Starter Skill-copy", visible: "private" })
    })
    expect(await screen.findByText("Clone created")).toBeInTheDocument()
  })

  it("renders skill detail with type explanation", async () => {
    renderWithRuntimeConfig(<SkillDetailPage params={{ skillUuid: "demo" }} />)
    expect(await screen.findByRole("heading", { name: "Skill Detail" })).toBeInTheDocument()
    expect(await screen.findByText("Private Skill owned and maintained in your workspace.")).toBeInTheDocument()
  })

  it("allows reference rename and pin controls without rollback", async () => {
    vi.mocked(api.getSkill).mockResolvedValueOnce({
      id: "ref-1",
      user_id: "user-1",
      name: "Starter Skill Ref",
      description: "Public starter",
      visible: "private",
      source_skill_id: "public-1",
      pinned_version: null,
      resolved_version: "1.2.3",
      skill_kind: "reference",
      is_reference_read_only: true,
      current_version: null,
      is_active: true,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)
    vi.mocked(api.listSkillFiles).mockResolvedValueOnce(["SKILL.md"])
    vi.mocked(api.listSkillVersions).mockResolvedValueOnce({
      items: [
        {
          version: "1.2.3",
          description: "Public starter",
          dependencies: [],
          dependency_spec: {},
          metadata: {},
          created_at: "2026-04-08T00:00:00Z",
        },
      ],
    } as any)
    vi.mocked(api.getSkillVersion).mockResolvedValueOnce({
      version: "1.2.3",
      description: "Public starter",
      dependencies: [],
      dependency_spec: {},
      metadata: {},
      created_at: "2026-04-08T00:00:00Z",
    } as any)
    vi.mocked(api.pinReferenceSkillVersion).mockResolvedValueOnce({
      id: "ref-1",
      user_id: "user-1",
      name: "Starter Skill Ref",
      description: "Public starter",
      visible: "private",
      source_skill_id: "public-1",
      pinned_version: "1.2.3",
      resolved_version: "1.2.3",
      skill_kind: "reference",
      is_reference_read_only: true,
      current_version: null,
      is_active: true,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)
    vi.mocked(api.unpinReferenceSkillVersion).mockResolvedValueOnce({
      id: "ref-1",
      user_id: "user-1",
      name: "Starter Skill Ref",
      description: "Public starter",
      visible: "private",
      source_skill_id: "public-1",
      pinned_version: null,
      resolved_version: "1.2.4",
      skill_kind: "reference",
      is_reference_read_only: true,
      current_version: null,
      is_active: true,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)
    vi.mocked(api.updateSkill).mockResolvedValueOnce({
      id: "ref-1",
      user_id: "user-1",
      name: "Renamed Ref",
      description: "Public starter",
      visible: "private",
      source_skill_id: "public-1",
      pinned_version: null,
      resolved_version: "1.2.3",
      skill_kind: "reference",
      is_reference_read_only: true,
      current_version: null,
      is_active: true,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)

    renderWithRuntimeConfig(<SkillDetailPage params={{ skillUuid: "ref-1" }} />)
    await screen.findByText("Reference Skill following the latest public source version.")

    await activateTab("Settings")
    fireEvent.change(await screen.findByLabelText("Skill name"), { target: { value: "Renamed Ref" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => {
      expect(api.updateSkill).toHaveBeenCalledWith("ref-1", { name: "Renamed Ref" })
    })

    await activateTab("Versions")
    fireEvent.click(await screen.findByLabelText("Select version 1.2.3"))
    fireEvent.click(await screen.findByRole("button", { name: "Pin to 1.2.3" }))
    await waitFor(() => {
      expect(api.pinReferenceSkillVersion).toHaveBeenCalledWith("ref-1", "1.2.3")
    })
  })

  it("keeps version selected when clicking the version checkbox", async () => {
    vi.mocked(api.getSkill).mockResolvedValueOnce({
      id: "skill-1",
      name: "Versioned Skill",
      description: "demo",
      visible: "private",
      skill_kind: "regular",
      is_reference_read_only: false,
      current_version: "1.0.0",
      is_active: true,
    } as any)
    vi.mocked(api.listSkillFiles).mockResolvedValueOnce(["SKILL.md"])
    vi.mocked(api.listSkillVersions).mockResolvedValueOnce({
      items: [
        { version: "1.0.0", description: "demo", dependencies: [], dependency_spec: {}, metadata: {}, created_at: "2026-04-08T00:00:00Z" },
      ],
    } as any)
    vi.mocked(api.getSkillVersion).mockResolvedValueOnce({
      version: "1.0.0",
      description: "demo",
      dependencies: [],
      dependency_spec: {},
      metadata: {},
      created_at: "2026-04-08T00:00:00Z",
    } as any)

    renderWithRuntimeConfig(<SkillDetailPage params={{ skillUuid: "skill-1" }} />)
    await screen.findByText("Versioned Skill")
    expect(screen.getByRole("tab", { name: "Versions" })).toBeInTheDocument()
  })

  it("deletes a skill and returns to the skills list through the router", async () => {
    vi.mocked(api.getSkill).mockResolvedValueOnce({
      id: "skill-delete",
      name: "Delete Me",
      description: "demo",
      visible: "private",
      skill_kind: "regular",
      is_reference_read_only: false,
      current_version: "1.0.0",
      is_active: true,
    } as any)
    vi.mocked(api.listSkillFiles).mockResolvedValueOnce([])
    vi.mocked(api.deleteSkill).mockResolvedValueOnce(undefined)

    renderWithRuntimeConfig(<SkillDetailPage params={{ skillUuid: "skill-delete" }} />)
    await screen.findByText("Delete Me")
    await activateTab("Settings")
    fireEvent.click(await screen.findByRole("button", { name: "Delete Skill" }))
    fireEvent.click(await screen.findByText("Delete Skill only"))
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/skills")
    })
  })

  it("renders tokens page with connect client guidance", async () => {
    renderWithRuntimeConfig(<TokensPage />)
    expect(await screen.findByRole("heading", { name: "Tokens" })).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "Create Token" })).toBeInTheDocument()
  })

  it("renders profile form", async () => {
    renderWithRuntimeConfig(<ProfilePage />)
    expect(await screen.findByRole("heading", { name: "个人信息" })).toBeInTheDocument()
    expect(await screen.findByLabelText("显示名称")).toBeInTheDocument()
  })

  it("deletes account and routes back to login from security page", async () => {
    replaceMock.mockClear()
    vi.mocked(api.requestDeleteAccount).mockResolvedValueOnce(undefined)
    vi.mocked(api.deleteAccount).mockResolvedValueOnce(undefined)
    renderWithRuntimeConfig(<SecurityPage />)
    fireEvent.click(screen.getByRole("button", { name: "Request deletion code" }))
    await screen.findByLabelText("Deletion verification code")
    fireEvent.change(screen.getByLabelText("Deletion verification code"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }))
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
  })
})
