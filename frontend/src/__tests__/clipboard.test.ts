import { afterEach, describe, expect, it, vi } from "vitest"

import { copyTextToClipboard } from "@/lib/clipboard"

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, "clipboard")
    Reflect.deleteProperty(document, "execCommand")
  })

  it("uses the legacy DOM copy path when navigator clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined
    })

    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand
    })

    await expect(copyTextToClipboard("ask_live_demo")).resolves.toBeUndefined()
    expect(execCommand).toHaveBeenCalledWith("copy")
    expect(document.body.querySelector("textarea")).toBeNull()
  })
})
