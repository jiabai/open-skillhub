import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, normalize } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { createProjectConfigStore } from "@/core/storage/project-config"

describe("project config store", () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()

      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  function createTempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "skilldrive-projects-"))
    tempRoots.push(root)
    return root
  }

  it("returns an empty snapshot before projects.json exists", async () => {
    const root = createTempRoot()
    const store = createProjectConfigStore(join(root, "config", "projects.json"), {
      now: () => new Date("2026-05-07T00:00:00.000Z")
    })

    await expect(store.listProjects()).resolves.toEqual({
      checkedAt: "2026-05-07T00:00:00.000Z",
      projects: []
    })
  })

  it("persists normalized project records in projects.json", async () => {
    const root = createTempRoot()
    const projectDir = join(root, "Example")
    await mkdir(projectDir)
    const store = createProjectConfigStore(join(root, "config", "projects.json"), {
      idFactory: () => "project-1",
      now: () => new Date("2026-05-07T01:02:03.000Z"),
      platform: "win32"
    })

    const snapshot = await store.addProject({
      name: "  Example Project  ",
      path: `${projectDir}\\`
    })

    expect(snapshot.projects).toEqual([
      {
        id: "project-1",
        name: "Example Project",
        path: normalize(projectDir),
        addedAt: "2026-05-07T01:02:03.000Z",
        updatedAt: "2026-05-07T01:02:03.000Z"
      }
    ])
    expect(JSON.parse(readFileSync(join(root, "config", "projects.json"), "utf8"))).toEqual({
      projects: snapshot.projects
    })
  })

  it("falls back to an empty list when projects.json contains invalid JSON", async () => {
    const root = createTempRoot()
    const filePath = join(root, "config", "projects.json")
    await mkdir(join(root, "config"))
    writeFileSync(filePath, "{not-json", "utf8")
    const store = createProjectConfigStore(filePath, {
      now: () => new Date("2026-05-07T00:00:00.000Z")
    })

    await expect(store.listProjects()).resolves.toEqual({
      checkedAt: "2026-05-07T00:00:00.000Z",
      projects: []
    })
  })

  it("rejects duplicate names and duplicate normalized paths", async () => {
    const root = createTempRoot()
    const projectDir = join(root, "Example")
    await mkdir(projectDir)
    const store = createProjectConfigStore(join(root, "config", "projects.json"), {
      idFactory: () => "project-1",
      now: () => new Date("2026-05-07T00:00:00.000Z"),
      platform: "win32"
    })

    await store.addProject({ name: "Example Project", path: projectDir })

    await expect(
      store.addProject({ name: "example project", path: join(root, "Other") })
    ).rejects.toThrow(/already exists/i)
    await expect(
      store.addProject({ name: "Different", path: projectDir.toUpperCase() })
    ).rejects.toThrow(/already registered/i)
  })

  it("renames and removes only the persisted project record", async () => {
    const root = createTempRoot()
    const projectDir = join(root, "Example")
    await mkdir(projectDir)
    const store = createProjectConfigStore(join(root, "config", "projects.json"), {
      idFactory: () => "project-1",
      now: () => new Date("2026-05-07T00:00:00.000Z")
    })

    await store.addProject({ name: "Example", path: projectDir })
    const renamed = await store.renameProject({
      projectId: "project-1",
      name: "Renamed"
    })

    expect(renamed.projects[0]?.name).toBe("Renamed")

    const removed = await store.removeProject({ projectId: "project-1" })

    expect(removed.projects).toEqual([])
    expect(statSync(projectDir).isDirectory()).toBe(true)
  })
})
