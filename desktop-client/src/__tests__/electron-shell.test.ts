import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("Electron shell behavior", () => {
  it("runs as a tray-first desktop window on Windows", () => {
    const mainSource = readFileSync(join(process.cwd(), "electron", "main.ts"), "utf8")

    expect(mainSource).toContain("TARGET_RENDERER_PHYSICAL_SIZE")
    expect(mainSource).toContain("width: 1984")
    expect(mainSource).toContain("height: 1168")
    expect(mainSource).toContain("screen.getPrimaryDisplay().scaleFactor")
    expect(mainSource).toContain("width: initialContentSize.width")
    expect(mainSource).toContain("height: initialContentSize.height")
    expect(mainSource).toContain("useContentSize: true")
    expect(mainSource).toContain("maximizable: true")
    expect(mainSource).toContain("resizable: true")
    expect(mainSource).toContain("autoHideMenuBar: true")
    expect(mainSource).toContain("skipTaskbar: false")
    expect(mainSource).toContain("Menu.setApplicationMenu(null)")
    expect(mainSource).toContain("function toggleMainWindow")
    expect(mainSource).toContain("tray.on(\"click\", () => toggleMainWindow())")
  })

  it("stages downloaded packages in owned cache directories for cleanup", () => {
    const mainSource = readFileSync(join(process.cwd(), "electron", "main.ts"), "utf8")
    const clientSkillApiSource = readFileSync(
      join(process.cwd(), "src", "core", "client-skills", "client-skill-api.ts"),
      "utf8"
    )

    expect(mainSource).toContain("createClientSkillApi")
    expect(clientSkillApiSource).toContain("mkdtemp(join(options.cacheDirectory, \"package-\"))")
    expect(clientSkillApiSource).toContain("createPackageArtifactFileName(payload, request)")
    expect(clientSkillApiSource).toContain("sanitizedDownloadFileName !== \"..\"")
    expect(clientSkillApiSource).toContain("const artifactPath = join(artifactRoot, createPackageArtifactFileName(payload, request))")
    expect(clientSkillApiSource).toContain("cleanupPaths: [artifactRoot]")
    expect(clientSkillApiSource).toContain("rm(artifactRoot, { recursive: true, force: true })")
  })

  it("uses cross-platform archive extraction instead of Windows PowerShell", () => {
    const mainSource = readFileSync(join(process.cwd(), "electron", "main.ts"), "utf8")

    expect(mainSource).toContain("extractZipArchive")
    expect(mainSource).not.toContain("powershell.exe")
    expect(mainSource).not.toContain("Expand-Archive")
    expect(mainSource).not.toContain("Archive extraction is currently implemented for Windows desktop only")
  })
})
