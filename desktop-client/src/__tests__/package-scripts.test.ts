import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

type PackageJson = {
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
      "vite build --config vite.electron.config.ts"
    )
  })
})
