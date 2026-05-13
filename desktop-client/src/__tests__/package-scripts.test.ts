import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

type PackageJson = {
  author?: {
    name?: string
  }
  build?: {
    appId?: string
    extraResources?: Array<{ from: string; to: string }>
    mac?: {
      category?: string
      entitlements?: string
      entitlementsInherit?: string
      forceCodeSigning?: boolean
      hardenedRuntime?: boolean
      icon?: string
      identity?: string | null
      notarize?: boolean
      target?: string[]
    }
    productName?: string
  }
  description?: string
  main?: string
  scripts?: Record<string, string>
}

describe("desktop package scripts", () => {
  it("exposes one canonical command for launching the full Electron runtime", () => {
    const packageJsonPath = join(process.cwd(), "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson

    expect(packageJson.main).toBe("dist-electron/main.js")
    expect(packageJson.scripts?.["start:electron"]).toBe("npm run build && electron .")
    expect(packageJson.scripts?.["build"]).toContain("npm run build:electron")
    expect(packageJson.scripts?.["build:electron"]).toBe(
      "vite build --config vite.electron.config.ts && vite build --config vite.preload.config.ts"
    )
  })

  it("keeps Windows installer metadata aligned with the runtime app identity", () => {
    const packageJsonPath = join(process.cwd(), "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson
    const mainSource = readFileSync(join(process.cwd(), "electron", "main.ts"), "utf8")

    expect(packageJson.description).toBe("SkillDrive desktop sync client")
    expect(packageJson.author?.name).toBe("SkillDrive contributors")
    expect(packageJson.build?.appId).toBe("com.skilldrive.skilldrive-desktop")
    expect(packageJson.build?.productName).toBe("SkillDrive Desktop")
    expect(mainSource).toContain('const APP_USER_MODEL_ID = "com.skilldrive.skilldrive-desktop"')
  })

  it("includes the Windows tray icon in extraResources for packaged runtime", () => {
    const packageJsonPath = join(process.cwd(), "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson

    expect(packageJson.build?.extraResources).toEqual([
      { from: "resources/icons/icon.ico", to: "icons/icon.ico" }
    ])
  })

  it("keeps macOS packaging exploratory while signing and notarization are deferred", () => {
    const packageJsonPath = join(process.cwd(), "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson

    expect(packageJson.scripts?.["dist:mac"]).toBe("electron-builder --mac")
    expect(packageJson.build?.mac?.target).toEqual(["dmg", "zip"])
    expect(packageJson.build?.mac?.icon).toBe("resources/icons/icon.icns")
    expect(packageJson.build?.mac?.category).toBe("public.app-category.productivity")
    expect(packageJson.build?.mac?.identity).toBeNull()
    expect(packageJson.build?.mac?.hardenedRuntime).toBe(true)
    expect(packageJson.build?.mac?.forceCodeSigning).toBe(false)
    expect(packageJson.build?.mac?.notarize).toBe(false)
    expect(packageJson.build?.mac?.entitlements).toBeUndefined()
    expect(packageJson.build?.mac?.entitlementsInherit).toBeUndefined()
  })

  it("keeps future macOS hardened runtime entitlements free of release secrets", () => {
    const appEntitlementsPath = join(process.cwd(), "build", "entitlements.mac.plist")
    const inheritEntitlementsPath = join(
      process.cwd(),
      "build",
      "entitlements.mac.inherit.plist"
    )

    expect(existsSync(appEntitlementsPath)).toBe(true)
    expect(existsSync(inheritEntitlementsPath)).toBe(true)

    for (const entitlementsPath of [appEntitlementsPath, inheritEntitlementsPath]) {
      const entitlements = readFileSync(entitlementsPath, "utf8")

      expect(entitlements).toContain("<key>com.apple.security.cs.allow-jit</key>")
      expect(entitlements).toContain(
        "<key>com.apple.security.cs.allow-unsigned-executable-memory</key>"
      )
      expect(entitlements).toContain(
        "<key>com.apple.security.cs.disable-library-validation</key>"
      )
      expect(entitlements).not.toContain("com.apple.security.app-sandbox")
      expect(entitlements).not.toContain("com.apple.security.network")
      expect(entitlements).not.toContain("APPLE_")
      expect(entitlements).not.toContain("CSC_")
    }
  })
})
