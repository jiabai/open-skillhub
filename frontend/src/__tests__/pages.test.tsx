import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

import { RuntimeConfigContext } from "@/components/app/runtime-config-provider"
import { I18nProvider } from "@/i18n/i18n-provider"
import { getDictionary } from "@/i18n/get-dictionary"
import HomePage from "@/app/page"
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

const referencedPublicSkillsPayload = {
  items: [
    {
      ...publicSkillsPayload.items[0],
      has_reference: true,
    },
  ],
  total: 1,
} as any

function renderWithRuntimeConfig(node: React.ReactNode) {
  return render(
    <I18nProvider locale="zh-CN" dictionary={getDictionary("zh-CN")}>
      <RuntimeConfigContext.Provider value={{ config: getRuntimeConfigSnapshot(), isLoading: false }}>
        {node}
      </RuntimeConfigContext.Provider>
    </I18nProvider>
  )
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard")
  Reflect.deleteProperty(document, "execCommand")
})

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
        desktop_release_url: "https://github.com/jiabai/skilldrive/releases",
        desktop_release_version: "v0.1.4",
      },
    })
  })

  it("renders login form", () => {
    renderWithRuntimeConfig(<LoginPage />)
    expect(screen.getByText("8xf SkillDrive")).toBeInTheDocument()
    expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(1)
  })

  it("renders the public landing page control room", () => {
    renderWithRuntimeConfig(<HomePage />)

    expect(screen.getByRole("heading", { name: "8xf SkillDrive" })).toBeInTheDocument()
    expect(screen.getByText("Agent Skill Control Room")).toBeInTheDocument()
    expect(screen.getByText("review-checklist")).toBeInTheDocument()
    expect(screen.getByText("v1.2.0 active")).toBeInTheDocument()
    expect(screen.getByText("API Token")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "创建账户" })).toHaveAttribute("href", "/register")
    expect(screen.getByRole("link", { name: "公共 Skills" })).toHaveAttribute("href", "/public-skills")
  })

  it("shows auth-only helper when email otp is the only login method", () => {
    renderWithRuntimeConfig(<LoginPage />)
    expect(screen.getByText("仅用于认证")).toBeInTheDocument()
  })

  it("hides auth-only helper when all login methods are disabled", () => {
    __setRuntimeConfigForTests({
      capabilities: {
        email_otp_login: false,
        sso: false,
        ldap: false,
      },
    })

    renderWithRuntimeConfig(<LoginPage />)
    expect(screen.queryByText("仅用于认证")).not.toBeInTheDocument()
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
    expect(screen.getByText("8xf SkillDrive")).toBeInTheDocument()
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
    expect(await screen.findByRole("heading", { name: "工作区" })).toBeInTheDocument()
    expect(await screen.findByText("从这里开始")).toBeInTheDocument()
    expect(await screen.findByText("下载桌面端")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /打开下载页/ })).toHaveAttribute(
      "href",
      "https://github.com/jiabai/skilldrive/releases"
    )
    expect(await screen.findByText("我的工作区概览")).toBeInTheDocument()
    expect(await screen.findByText("开始前要知道")).toBeInTheDocument()
  })

  it("renders rbac dashboard overview", async () => {
    __setRuntimeConfigForTests({
      capabilities: {
        rbac: true,
        no_rbac_mode: false,
        audit_log: true,
      },
    })
    vi.mocked(api.getMe).mockResolvedValueOnce({
      id: "admin-1",
      email: "admin@example.com",
      username: "admin",
      is_active: true,
      is_superuser: true,
      enterprise_id: null,
      team_id: null,
      role: "admin",
      status: "active",
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)
    renderWithRuntimeConfig(<DashboardPage />)
    expect(await screen.findByRole("heading", { name: "概览" })).toBeInTheDocument()
    expect(await screen.findByText("团队 / 组织概览")).toBeInTheDocument()
    expect(await screen.findByText("Skill 治理")).toBeInTheDocument()
    expect(await screen.findByText("审计与访问")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "审计" })).toBeInTheDocument()
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
    expect(await screen.findByRole("heading", { name: "我的 Skills" })).toBeInTheDocument()
    expect(await screen.findByText("引用 - 跟随公共源版本")).toBeInTheDocument()
  })

  it("renders public skills list with no-rbac explainer", async () => {
    vi.mocked(api.listPublicSkills).mockResolvedValueOnce(publicSkillsPayload)

    renderWithRuntimeConfig(<PublicSkillsPage />)
    expect(await screen.findByRole("heading", { name: "公共 Skills" })).toBeInTheDocument()
    expect(await screen.findByText("适合想快速开始使用公共 Skill，但暂时不接管其文件的时候。")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "克隆" })).toBeInTheDocument()
    expect(await screen.findByText("推荐第一步：引用")).toBeInTheDocument()
  })

  it("triggers public skill actions and shows next steps", async () => {
    vi.mocked(api.listPublicSkills)
      .mockResolvedValueOnce(publicSkillsPayload)
      .mockResolvedValueOnce(referencedPublicSkillsPayload)

    renderWithRuntimeConfig(<PublicSkillsPage />)
    await screen.findByText("Starter Skill")

    fireEvent.click(screen.getByRole("button", { name: "添加引用" }))
    await waitFor(() => {
      expect(api.referencePublicSkill).toHaveBeenCalledWith("public-1", { name: "Starter Skill" })
    })
    expect(await screen.findByText("引用已创建")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "克隆" })).not.toBeInTheDocument()
    })
  })

  it("renders skill detail with type explanation", async () => {
    renderWithRuntimeConfig(<SkillDetailPage params={{ skillUuid: "demo" }} />)
    expect(await screen.findByRole("heading", { name: "Skill 详情" })).toBeInTheDocument()
    expect(await screen.findByText("私有 Skill，由你的工作区独立维护。")).toBeInTheDocument()
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
    await screen.findByText("引用 Skill，当前跟随公共源的最新版本。")

    await activateTab("设置")
    fireEvent.change(await screen.findByLabelText("Skill 名称"), { target: { value: "Renamed Ref" } })
    fireEvent.click(screen.getByRole("button", { name: "保存更改" }))
    await waitFor(() => {
      expect(api.updateSkill).toHaveBeenCalledWith("ref-1", { name: "Renamed Ref" })
    })

    await activateTab("版本")
    fireEvent.click(await screen.findByLabelText("选择版本 1.2.3"))
    fireEvent.click(await screen.findByRole("button", { name: "固定到 1.2.3" }))
    await waitFor(() => {
      expect(api.pinReferenceSkillVersion).toHaveBeenCalledWith("ref-1", "1.2.3")
    })
  })

  it("creates an editable copy from a reference detail page", async () => {
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
    vi.mocked(api.clonePublicSkill).mockResolvedValueOnce({ id: "clone-1", name: "Starter Skill Ref-副本" } as any)

    renderWithRuntimeConfig(<SkillDetailPage params={{ skillUuid: "ref-1" }} />)
    expect(await screen.findByText("需要自己的可编辑副本？")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "创建可编辑副本" }))
    await waitFor(() => {
      expect(api.clonePublicSkill).toHaveBeenCalledWith("public-1", { name: "Starter Skill Ref-副本", visible: "private" })
    })
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/skills/clone-1")
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
    expect(screen.getByRole("tab", { name: "版本" })).toBeInTheDocument()
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
    await activateTab("设置")
    fireEvent.click(await screen.findByRole("button", { name: "删除 Skill" }))
    fireEvent.click(await screen.findByText("只删除 Skill"))
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/skills")
    })
  })

  it("renders tokens page with connect client guidance", async () => {
    renderWithRuntimeConfig(<TokensPage />)
    expect(await screen.findByRole("heading", { name: "令牌" })).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "创建令牌" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "连接客户端" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /下载 Windows 桌面端 v0\.1\.4/ })).toHaveAttribute(
      "href",
      "https://github.com/jiabai/skilldrive/releases"
    )
    expect(screen.getByRole("link", { name: /下载 macOS 桌面端 v0\.1\.4/ })).toHaveAttribute(
      "href",
      "https://github.com/jiabai/skilldrive/releases"
    )
  })

  it("copies a newly created token even when navigator clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined
    })
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand
    })

    renderWithRuntimeConfig(<TokensPage />)

    fireEvent.change(screen.getByLabelText("令牌名称"), {
      target: { value: "local-client" }
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "创建令牌" }))
    })

    const copyButton = await screen.findByRole("button", { name: "复制" })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith("copy")
    })
  })

  it("renders profile identity summary before editable settings", async () => {
    renderWithRuntimeConfig(<ProfilePage />)
    const identityHeading = await screen.findByRole("heading", { name: "身份摘要" })
    const basicHeading = screen.getByRole("heading", { name: "基础资料" })
    const bindHeading = screen.getByRole("heading", { name: "绑定新邮箱" })

    expect(identityHeading.compareDocumentPosition(basicHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(basicHeading.compareDocumentPosition(bindHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("shows regular-user identity and hides the default workspace role in non-rbac mode", async () => {
    renderWithRuntimeConfig(<ProfilePage />)

    expect(await screen.findByText("普通用户")).toBeInTheDocument()
    expect(screen.getByText("活跃")).toBeInTheDocument()
    expect(screen.queryByText("工作区角色")).not.toBeInTheDocument()
    expect(screen.queryByText("user-1")).not.toBeInTheDocument()
    expect(screen.queryByText("2026-04-08T00:00:00Z")).not.toBeInTheDocument()
    expect(await screen.findByLabelText("显示名称")).toBeInTheDocument()
  })

  it("shows platform admin identity and workspace role for privileged users", async () => {
    __setRuntimeConfigForTests({
      capabilities: {
        rbac: true,
        org_model: true,
      },
    })
    vi.mocked(api.getMe).mockResolvedValueOnce({
      id: "admin-1",
      email: "admin@example.com",
      username: "admin",
      is_active: true,
      is_superuser: true,
      enterprise_id: null,
      team_id: null,
      role: "admin",
      status: "active",
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)

    renderWithRuntimeConfig(<ProfilePage />)

    expect(await screen.findByText("平台管理员")).toBeInTheDocument()
    expect(screen.getByText("超管")).toBeInTheDocument()
    expect(screen.getByText("工作区角色")).toBeInTheDocument()
    expect(screen.getByText("管理员")).toBeInTheDocument()
  })

  it("shows organization summaries and raw ids as secondary details when org model is enabled", async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce({
      id: "user-2",
      email: "org@example.com",
      username: "org-user",
      is_active: true,
      is_superuser: false,
      enterprise_id: "ent-001",
      team_id: "team-123",
      role: "member",
      status: "pending",
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    } as any)

    renderWithRuntimeConfig(<ProfilePage />)

    expect(await screen.findByText("组织归属")).toBeInTheDocument()
    expect(screen.getByText("企业归属")).toBeInTheDocument()
    expect(screen.getByText("团队归属")).toBeInTheDocument()
    expect(screen.getByText("已关联企业")).toBeInTheDocument()
    expect(screen.getByText("已关联团队")).toBeInTheDocument()
    expect(screen.getByText("ent-001")).toBeInTheDocument()
    expect(screen.getByText("team-123")).toBeInTheDocument()
    expect(screen.getByText("待激活")).toBeInTheDocument()
  })

  it("hides organization summary when org model is disabled", async () => {
    __setRuntimeConfigForTests({
      capabilities: {
        org_model: false,
      },
    })

    renderWithRuntimeConfig(<ProfilePage />)

    expect(await screen.findByRole("heading", { name: "身份摘要" })).toBeInTheDocument()
    expect(screen.queryByText("组织归属")).not.toBeInTheDocument()
    expect(screen.queryByText("企业归属")).not.toBeInTheDocument()
  })

  it("deletes account and routes back to login from security page", async () => {
    replaceMock.mockClear()
    vi.mocked(api.requestDeleteAccount).mockResolvedValueOnce(undefined)
    vi.mocked(api.deleteAccount).mockResolvedValueOnce(undefined)
    renderWithRuntimeConfig(<SecurityPage />)
    fireEvent.click(screen.getByRole("button", { name: "申请删除验证码" }))
    await screen.findByLabelText("删除验证码")
    fireEvent.change(screen.getByLabelText("删除验证码"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "删除账户" }))
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }))
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login")
    })
  })
})
