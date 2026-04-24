import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("Electron shell behavior", () => {
  it("runs as a compact tray-first desktop panel on Windows", () => {
    const mainSource = readFileSync(join(process.cwd(), "electron", "main.ts"), "utf8")

    expect(mainSource).toContain("width: 460")
    expect(mainSource).toContain("height: 720")
    expect(mainSource).toContain("autoHideMenuBar: true")
    expect(mainSource).toContain("skipTaskbar: process.platform === \"win32\"")
    expect(mainSource).toContain("Menu.setApplicationMenu(null)")
    expect(mainSource).toContain("function toggleMainWindow")
    expect(mainSource).toContain("tray.on(\"click\", () => toggleMainWindow())")
  })
})
