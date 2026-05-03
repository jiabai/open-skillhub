import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

type PackageJson = {
  author?: {
    name?: string
  }
  build?: {
    appId?: string
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

    expect(packageJson.description).toBe("Open SkillHub desktop sync client")
    expect(packageJson.author?.name).toBe("Open SkillHub contributors")
    expect(packageJson.build?.appId).toBe("com.openskillhub.skilldrive-desktop")
    expect(packageJson.build?.productName).toBe("SkillDrive Desktop")
    expect(mainSource).toContain('const APP_USER_MODEL_ID = "com.openskillhub.skilldrive-desktop"')
  })
})
