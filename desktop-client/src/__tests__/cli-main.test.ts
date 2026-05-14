import { describe, expect, it } from "vitest"

import { createSkillDriveCliProgram, mapCliErrorToExitCode } from "@/cli/main"
import { CliError } from "@/cli/services/cli-errors"

describe("skilldrive-cli CLI entry", () => {
  it("registers Linux distribution commands without loading Electron", async () => {
    const output: string[] = []
    const program = createSkillDriveCliProgram({
      stdout: (value) => output.push(value),
      stderr: (value) => output.push(value)
    })

    await expect(
      program.parseAsync(["node", "skilldrive-cli", "detect", "--help"])
    ).rejects.toMatchObject({ code: "commander.helpDisplayed" })

    expect(output.join("\n")).toContain("Usage: skilldrive-cli detect")
    expect(output.join("\n")).toContain("--global")
    expect(output.join("\n")).toContain("--project <path>")
  })

  it("maps expected CLI error classes to stable exit codes", () => {
    expect(mapCliErrorToExitCode(new CliError("validation", "bad input"))).toBe(1)
    expect(mapCliErrorToExitCode(new CliError("partial-failure", "some failed"))).toBe(2)
    expect(mapCliErrorToExitCode(new CliError("no-targets", "none"))).toBe(3)
    expect(mapCliErrorToExitCode(new CliError("remote", "api failed"))).toBe(4)
    expect(mapCliErrorToExitCode(new CliError("unsupported-encrypted-download", "encrypted"))).toBe(5)
    expect(mapCliErrorToExitCode(new Error("unknown"))).toBe(1)
  })
})
