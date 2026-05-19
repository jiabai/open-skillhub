import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RuntimeConfigContext } from "@/components/app/runtime-config-provider"
import { I18nProvider } from "@/i18n/i18n-provider"
import { getDictionary } from "@/i18n/get-dictionary"
import { getRuntimeConfigSnapshot } from "@/lib/runtime-config"
import HelpPage from "@/app/help/page"

function renderHelpPage() {
  return render(
    <I18nProvider locale="zh-CN" dictionary={getDictionary("zh-CN")}>
      <RuntimeConfigContext.Provider value={{ config: getRuntimeConfigSnapshot(), isLoading: false }}>
        <HelpPage />
      </RuntimeConfigContext.Provider>
    </I18nProvider>
  )
}

describe("help page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
      }))
    )
  })

  it("renders the help center table of contents and localized content", () => {
    renderHelpPage()

    expect(screen.getByRole("heading", { name: "帮助中心" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "SkillDrive 是什么" })).toHaveAttribute("href", "#what-is-skilldrive")
    expect(screen.getByRole("heading", { name: "快速入门" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument()
    expect(screen.getByText(/SkillDrive 是一个用来管理 Skills 的控制台/)).toBeInTheDocument()
    expect(screen.getByText(/如果你只是想先用起来，建议选择引用/)).toBeInTheDocument()
  })

  it("opens the mobile help directory from the page toolbar", () => {
    renderHelpPage()

    fireEvent.click(screen.getByRole("button", { name: "打开帮助目录" }))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "帮助目录" })).toBeInTheDocument()
  })
})
