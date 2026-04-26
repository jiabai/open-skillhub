import type {
  PreDistributionVersionComparison,
  PreDistributionVersionFormat
} from "@/types"

export interface StrictSemverVersion {
  major: number
  minor: number
  patch: number
}

const strictSemverPattern = /^v?(\d+)\.(\d+)\.(\d+)$/

export function parseStrictSemver(version: string | null | undefined): StrictSemverVersion | null {
  const trimmed = version?.trim()

  if (!trimmed) {
    return null
  }

  const match = strictSemverPattern.exec(trimmed)

  if (!match) {
    return null
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10)
  }
}

export function getVersionFormat(version: string | null | undefined): PreDistributionVersionFormat {
  return parseStrictSemver(version) ? "semver" : "unknown"
}

export function compareStrictSemverVersions(
  installedVersion: string,
  remoteVersion: string
): PreDistributionVersionComparison {
  const installed = parseStrictSemver(installedVersion)
  const remote = parseStrictSemver(remoteVersion)

  if (!installed || !remote) {
    return "unknown"
  }

  if (installed.major !== remote.major) {
    return installed.major > remote.major ? "installed-newer" : "installed-older"
  }

  if (installed.minor !== remote.minor) {
    return installed.minor > remote.minor ? "installed-newer" : "installed-older"
  }

  if (installed.patch !== remote.patch) {
    return installed.patch > remote.patch ? "installed-newer" : "installed-older"
  }

  return "same"
}
