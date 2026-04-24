import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("Electron shell behavior", () => {
  it("runs as a tray-first desktop window on Windows", () => {
    const mainSource = readFileSync(join(process.cwd(), "electron", "main.ts"), "utf8")

    expect(mainSource).toContain("width: 1984")
    expect(mainSource).toContain("height: 1168")
    expect(mainSource).toContain("autoHideMenuBar: true")
    expect(mainSource).toContain("skipTaskbar: process.platform === \"win32\"")
    expect(mainSource).toContain("Menu.setApplicationMenu(null)")
    expect(mainSource).toContain("function toggleMainWindow")
    expect(mainSource).toContain("tray.on(\"click\", () => toggleMainWindow())")
  })
})
