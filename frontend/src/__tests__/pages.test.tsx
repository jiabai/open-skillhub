import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach } from "vitest"
import { vi } from "vitest"

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
  usePathname: () => "/"
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

function mockDownloadDom() {
  const createObjectURLMock = vi.fn(() => "blob:public-skill-download")
  const revokeObjectURLMock = vi.fn()
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const clickMock = vi.fn()
  const appendChildSpy = vi.spyOn(document.body, "appendChild")
  const removeChildSpy = vi.spyOn(document.body, "removeChild")
  const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    const element = document.createElementNS("http://www.w3.org/1999/xhtml", tagName)
    if (tagName.toLowerCase() === "a") {
      Object.defineProperty(element, "click", { value: clickMock })
    }
    return element
  })
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURLMock, configurable: true })
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURLMock, configurable: true })

  return {
    clickMock,
    restore() {
      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
      Object.defineProperty(URL, "createObjectURL", { value: originalCreateObjectURL, configurable: true })
      Object.defineProperty(URL, "revokeObjectURL", { value: originalRevokeObjectURL, configurable: true })
    },
  }
}

describe("console pages", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it("renders dashboard overview", async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect((await screen.findAllByRole("heading")).length).toBeGreaterThanOrEqual(1)
  })

  it("renders skills list", async () => {
    render(<SkillsPage />)
    expect(await screen.findByRole("heading", { name: "Skills" })).toBeInTheDocument()
  })

  it("renders public skills list", async () => {
    vi.mocked(api.listPublicSkills).mockResolvedValueOnce(publicSkillsPayload)

    render(<PublicSkillsPage />)
    expect(await screen.findByRole("heading", { name: "Public Skills" })).toBeInTheDocument()
    expect(await screen.findByText("Starter Skill")).toBeInTheDocument()
    expect(api.listPublicSkills).toHaveBeenCalled()
  })

  it("triggers public skill actions", async () => {
    vi.mocked(api.listPublicSkills).mockResolvedValue(publicSkillsPayload)

    render(<PublicSkillsPage />)
    await screen.findByText("Starter Skill")

    const downloadDom = mockDownloadDom()

    fireEvent.click(screen.getByRole("button", { name: "Download" }))
    await waitFor(() => {
      expect(api.downloadSkillRaw).toHaveBeenCalledWith({ skill_uuid: "public-1", version: "1.2.3" })
    })
    await waitFor(() => {
      expect(downloadDom.clickMock).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole("button", { name: "Add Reference" }))
    await waitFor(() => {
      expect(api.referencePublicSkill).toHaveBeenCalledWith("public-1", { name: "Starter Skill" })
    })

    fireEvent.click(screen.getByRole("button", { name: "Clone" }))
    await waitFor(() => {
      expect(api.clonePublicSkill).toHaveBeenCalledWith("public-1", { name: "Starter Skill-copy", visible: "private" })
    })

    downloadDom.restore()
  })

  it("downloads encrypted public skill after confirmation", async () => {
    vi.mocked(api.listPublicSkills).mockResolvedValue(publicSkillsPayload)
    vi.mocked(api.downloadSkillRaw).mockResolvedValueOnce({
      rawText: '{"encrypted":true}',
      payload: {
        skill_uuid: "public-1",
        version: "1.2.3",
        encrypted_code: "abc",
        checksum: "sha256:123",
        expires_at: "2026-04-08T00:00:00Z",
        archive_size_bytes: 128,
        encryption_enabled: true,
        download_filename: "skill-public-1-1.2.3.encrypted.json",
        decryption_hint: "Use the official decryption tool.",
      },
    } as any)
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const downloadDom = mockDownloadDom()

    render(<PublicSkillsPage />)
    await screen.findByText("Starter Skill")

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("Use the official decryption tool.")
    })
    await waitFor(() => {
      expect(downloadDom.clickMock).toHaveBeenCalled()
    })

    confirmSpy.mockRestore()
    downloadDom.restore()
  })

  it("cancels encrypted public skill download when confirmation is rejected", async () => {
    vi.mocked(api.listPublicSkills).mockResolvedValue(publicSkillsPayload)
    vi.mocked(api.downloadSkillRaw).mockResolvedValueOnce({
      rawText: '{"encrypted":true}',
      payload: {
        skill_uuid: "public-1",
        version: "1.2.3",
        encrypted_code: "abc",
        checksum: "sha256:123",
        expires_at: "2026-04-08T00:00:00Z",
        archive_size_bytes: 128,
        encryption_enabled: true,
        download_filename: "skill-public-1-1.2.3.encrypted.json",
        decryption_hint: "Use the official decryption tool.",
      },
    } as any)
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    const downloadDom = mockDownloadDom()

    render(<PublicSkillsPage />)
    await screen.findByText("Starter Skill")

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("Use the official decryption tool.")
    })
    expect(downloadDom.clickMock).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
    downloadDom.restore()
  })

  it("renders skill detail tabs", async () => {
    render(<SkillDetailPage params={{ skillUuid: "demo" }} />)
    expect(await screen.findByRole("heading")).toBeInTheDocument()
    expect(await screen.findAllByRole("tab")).not.toHaveLength(0)
  })

  it("renders tokens page", async () => {
    render(<TokensPage />)
    expect(await screen.findByRole("heading", { name: "API Tokens" })).toBeInTheDocument()
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
})
