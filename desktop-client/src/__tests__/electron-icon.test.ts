import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("electron icon embedding", () => {
  it("keeps the Windows icon asset and SVG fallback wired into the Electron runtime", () => {
    const rootDir = process.cwd()
    const iconSvgPath = join(rootDir, "resources", "icons", "icon.svg")
    const iconIcoPath = join(rootDir, "resources", "icons", "icon.ico")
    const electronMainSource = readFileSync(join(rootDir, "electron", "main.ts"), "utf8")
    const electronConfigSource = readFileSync(join(rootDir, "vite.electron.config.ts"), "utf8")
    const iconSvg = readFileSync(iconSvgPath, "utf8").trim()
    const iconIco = readFileSync(iconIcoPath)

    expect(iconSvg).toContain("<svg")
    expect(iconIco.subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]))
    expect(electronMainSource).toContain("resources/icons/icon.ico")
    expect(electronMainSource).toContain("createWindowsIcon")
    expect(electronMainSource).toContain("__EMBEDDED_ICON_SVG__")
    expect(electronMainSource).toContain("createEmbeddedIcon")
    expect(electronMainSource).toContain("resolveWindowsIconPath")
    expect(electronMainSource).toContain("app.isPackaged")
    expect(electronMainSource).toContain("process.resourcesPath")
    expect(electronConfigSource).toContain("resources/icons/icon.svg")
    expect(electronConfigSource).toContain("JSON.stringify(embeddedIconSvg)")
  })
})
