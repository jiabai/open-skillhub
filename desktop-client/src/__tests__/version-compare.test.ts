import { describe, expect, it } from "vitest"

import {
  compareStrictSemverVersions,
  getVersionFormat,
  parseStrictSemver
} from "@/core/pre-distribution-check/version-compare"

describe("pre-distribution version comparison", () => {
  it("parses strict semver with an optional leading v", () => {
    expect(parseStrictSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseStrictSemver("v10.20.30")).toEqual({ major: 10, minor: 20, patch: 30 })
  })

  it("treats unsupported version formats as unknown", () => {
    for (const version of ["1.0", "1.0.0-alpha.1", "1.0.0+build.1", "latest", "2026-04-26", ""]) {
      expect(parseStrictSemver(version)).toBeNull()
      expect(getVersionFormat(version)).toBe("unknown")
    }
  })

  it("compares installed and remote versions", () => {
    expect(compareStrictSemverVersions("1.0.0", "1.1.0")).toBe("installed-older")
    expect(compareStrictSemverVersions("1.1.0", "1.1.0")).toBe("same")
    expect(compareStrictSemverVersions("2.0.0", "1.9.9")).toBe("installed-newer")
    expect(compareStrictSemverVersions("latest", "1.0.0")).toBe("unknown")
  })
})
