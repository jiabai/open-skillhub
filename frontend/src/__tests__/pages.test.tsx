import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, vi } from "vitest"

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

describe("console pages", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_ENABLE_RBAC = "false"
  })

  it("renders login form", () => {
    render(<LoginPage />)
    expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(1)
  })

  it("redirects after login success", async () => {
    replaceMock.mockClear()
    render(<LoginPage />)
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
    render(<RegisterPage />)
    expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(1)
  })

  it("redirects to login after register success", async () => {
    replaceMock.mockClear()
    vi.useFakeTimers()
    await act(async () => {
      render(<RegisterPage />)
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
    render(<DashboardPage />)
    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeInTheDocument()
    expect(await screen.findByText("Start Here")).toBeInTheDocument()
    expect(await screen.findByText("My Workspace Snapshot")).toBeInTheDocument()
    expect(await screen.findByText("Need To Know")).toBeInTheDocument()
  })

  it("renders rbac dashboard overview", async () => {
    process.env.NEXT_PUBLIC_ENABLE_RBAC = "true"
    render(<DashboardPage />)
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(await screen.findByText("Team / Org Overview")).toBeInTheDocument()
    expect(await screen.findByText("Skill Governance")).toBeInTheDocument()
    expect(await screen.findByText("Audit & Access")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument()
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

    render(<SkillsPage />)
    expect(await screen.findByRole("heading", { name: "My Skills" })).toBeInTheDocument()
    expect(await screen.findByText("Reference - follows public source")).toBeInTheDocument()
  })

  it("renders public skills list with no-rbac explainer", async () => {
    vi.mocked(api.listPublicSkills).mockResolvedValueOnce(publicSkillsPayload)

    render(<PublicSkillsPage />)
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

    render(<PublicSkillsPage />)
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
    render(<SkillDetailPage params={{ skillUuid: "demo" }} />)
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

    render(<SkillDetailPage params={{ skillUuid: "ref-1" }} />)
    await screen.findByText("Starter Skill Ref")
    expect(await screen.findByText("Reference Skill following the latest public source version.")).toBeInTheDocument()

    const settingsTab = screen.getByRole("tab", { name: "Settings" })
    fireEvent.mouseDown(settingsTab)
    fireEvent.click(settingsTab)
    const nameInput = (await screen.findByDisplayValue("Starter Skill Ref")) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "Renamed Ref" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => {
      expect(api.updateSkill).toHaveBeenCalledWith("ref-1", { name: "Renamed Ref" })
    })

    const versionsTab = screen.getByRole("tab", { name: "Versions" })
    fireEvent.mouseDown(versionsTab)
    fireEvent.click(versionsTab)
    fireEvent.click(await screen.findByText("1.2.3"))
    expect(screen.queryByRole("button", { name: /Rollback/ })).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole("button", { name: "Pin to 1.2.3" }))
    await waitFor(() => {
      expect(api.pinReferenceSkillVersion).toHaveBeenCalledWith("ref-1", "1.2.3")
    })

    fireEvent.click(await screen.findByRole("button", { name: "Follow latest" }))
    await waitFor(() => {
      expect(api.unpinReferenceSkillVersion).toHaveBeenCalledWith("ref-1")
    })
  })

  it("keeps version selected when clicking the version checkbox", async () => {
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

    render(<SkillDetailPage params={{ skillUuid: "ref-1" }} />)
    await screen.findByText("Starter Skill Ref")

    const versionsTab = screen.getByRole("tab", { name: "Versions" })
    fireEvent.mouseDown(versionsTab)
    fireEvent.click(versionsTab)

    fireEvent.click(await screen.findByLabelText("Select version 1.2.3"))

    expect(await screen.findByText("Version 1.2.3")).toBeInTheDocument()
  })

  it("deletes a skill and returns to the skills list through the router", async () => {
    vi.mocked(api.getSkill).mockResolvedValueOnce({
      id: "skill-1",
      user_id: "user-1",
      name: "Private Skill",
      description: "Owned skill",
      visible: "private",
      skill_kind: "private",
      is_reference_read_only: false,
      is_active: true,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)
    vi.mocked(api.listSkillFiles).mockResolvedValueOnce(["SKILL.md"])

    render(<SkillDetailPage params={{ skillUuid: "skill-1" }} />)
    await screen.findByText("Private Skill")

    const settingsTab = screen.getByRole("tab", { name: "Settings" })
    fireEvent.mouseDown(settingsTab)
    fireEvent.click(settingsTab)

    fireEvent.click(await screen.findByRole("button", { name: "Delete Skill" }))
    fireEvent.click(await screen.findByRole("button", { name: "Delete Skill only" }))

    await waitFor(() => {
      expect(api.deleteSkill).toHaveBeenCalledWith("skill-1", false)
    })
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/skills")
    })
  })

  it("renders tokens page with connect client guidance", async () => {
    render(<TokensPage />)
    expect(await screen.findByRole("heading", { name: "Tokens" })).toBeInTheDocument()
    expect(await screen.findByText("Connect Client")).toBeInTheDocument()
  })

  it("renders profile form", async () => {
    render(<ProfilePage />)
    expect((await screen.findAllByRole("heading")).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByRole("textbox")).length).toBeGreaterThanOrEqual(1)
  })

  it("renders security form", () => {
    render(<SecurityPage />)
    expect(screen.getAllByRole("heading").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(1)
  })

  it("deletes account and routes back to login from security page", async () => {
    render(<SecurityPage />)

    fireEvent.click(screen.getByRole("button", { name: "Request deletion code" }))
    expect(await screen.findByText("Deletion verification code sent. Check your email inbox.")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Deletion verification code"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }))

    await waitFor(() => {
      expect(api.deleteAccount).toHaveBeenCalledWith({ code: "123456" })
    })
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
  })
})
