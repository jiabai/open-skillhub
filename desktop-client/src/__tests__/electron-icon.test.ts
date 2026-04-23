import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("electron icon embedding", () => {
  it("keeps the icon source and build-time embedding wired to one SVG file", () => {
    const rootDir = process.cwd()
    const iconSvgPath = join(rootDir, "resources", "icons", "icon.svg")
    const electronMainSource = readFileSync(join(rootDir, "electron", "main.ts"), "utf8")
    const electronConfigSource = readFileSync(join(rootDir, "vite.electron.config.ts"), "utf8")
    const iconSvg = readFileSync(iconSvgPath, "utf8").trim()

    expect(iconSvg).toContain("<svg")
    expect(electronMainSource).toContain("__EMBEDDED_ICON_SVG__")
    expect(electronMainSource).toContain("createEmbeddedIcon")
    expect(electronMainSource).not.toContain("resolveAppIconPath")
    expect(electronMainSource).not.toContain("existsSync(")
    expect(electronConfigSource).toContain("resources/icons/icon.svg")
    expect(electronConfigSource).toContain("JSON.stringify(embeddedIconSvg)")
  })
})
