import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createSyncPollingController,
  createSyncService
} from "@/core/sync/sync-service"
import { createSqliteStateStore } from "@/core/storage/state-db"
import type { RemoteSkillSummary } from "@/types"

describe("createSyncService", () => {
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
    const root = mkdtempSync(join(tmpdir(), "skilldrive-desktop-"))
    tempRoots.push(root)
    return root
  }

  it("refreshes remote skills and persists the comparison state", async () => {
    const rootDir = createTempRoot()
    const dbPath = join(rootDir, "state", "state.sqlite3")
    const stateStore = await createSqliteStateStore(dbPath)

    await stateStore.writeState({
      localRecords: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          installedVersion: "1.0.0",
          remoteVersion: "1.0.0",
          lastComparedAt: "2026-04-16T08:00:00.000Z"
        }
      ],
      pendingUpdates: [],
      successfulDistributionCount: 2,
      lastRefreshedAt: "2026-04-16T08:00:00.000Z"
    })

    const remoteSkills: RemoteSkillSummary[] = [
      {
        id: "skill-a",
        name: "Skill A",
        version: "1.1.0",
        updatedAt: "2026-04-17T08:00:00.000Z"
      },
      {
        id: "skill-b",
        name: "Skill B",
        version: "1.0.0",
        updatedAt: "2026-04-17T08:01:00.000Z"
      }
    ]
    const apiClient = {
      listClientSkills: vi.fn(async () => remoteSkills)
    }
    const service = createSyncService({
      apiClient,
      stateStore,
      now: () => "2026-04-17T09:00:00.000Z"
    })

    const result = await service.refresh()

    expect(apiClient.listClientSkills).toHaveBeenCalledTimes(1)
    expect(result.lastRefreshedAt).toBe("2026-04-17T09:00:00.000Z")
    expect(result.pendingUpdates).toEqual([
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        localVersion: "1.0.0",
        remoteVersion: "1.1.0",
        reason: "version-mismatch"
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        localVersion: null,
        remoteVersion: "1.0.0",
        reason: "missing-local-record"
      }
    ])

    expect(await stateStore.readState()).toEqual({
      localRecords: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          installedVersion: "1.0.0",
          remoteVersion: "1.1.0",
          lastComparedAt: "2026-04-17T09:00:00.000Z"
        },
        {
          remoteSkillId: "skill-b",
          name: "Skill B",
          installedVersion: null,
          remoteVersion: "1.0.0",
          lastComparedAt: "2026-04-17T09:00:00.000Z"
        }
      ],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: "1.0.0",
          remoteVersion: "1.1.0",
          reason: "version-mismatch"
        },
        {
          remoteSkillId: "skill-b",
          name: "Skill B",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 2,
      lastRefreshedAt: "2026-04-17T09:00:00.000Z"
    })

    await stateStore.close()
  })

  it("polls in the background without auto-distributing and updates tray review state", async () => {
    vi.useFakeTimers()

    const refresh = vi
      .fn()
      .mockResolvedValueOnce({
        items: [],
        localRecords: [],
        pendingUpdates: [
          {
            remoteSkillId: "skill-a",
            name: "Skill A",
            localVersion: null,
            remoteVersion: "1.0.0",
            reason: "missing-local-record"
          }
        ],
        comparedAt: "2026-04-17T09:00:00.000Z",
        lastRefreshedAt: "2026-04-17T09:00:00.000Z"
      })
      .mockResolvedValueOnce({
        items: [],
        localRecords: [],
        pendingUpdates: [
          {
            remoteSkillId: "skill-a",
            name: "Skill A",
            localVersion: null,
            remoteVersion: "1.0.0",
            reason: "missing-local-record"
          }
        ],
        comparedAt: "2026-04-17T09:01:00.000Z",
        lastRefreshedAt: "2026-04-17T09:01:00.000Z"
      })

    const tray = {
      setToolTip: vi.fn()
    }
    const notification = {
      show: vi.fn()
    }
    const createNotification = vi.fn(() => notification)

    const controller = createSyncPollingController({
      syncService: {
        refresh
      },
      tray,
      createNotification,
      pollIntervalMs: 1000
    })

    try {
      await controller.start()

      expect(refresh).toHaveBeenCalledTimes(1)
      expect(tray.setToolTip).toHaveBeenCalledWith(
        "SkillDrive Desktop - 1 pending review update"
      )
      expect(createNotification).toHaveBeenCalledTimes(1)
      expect(notification.show).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1000)

      expect(refresh).toHaveBeenCalledTimes(2)
      expect(createNotification).toHaveBeenCalledTimes(1)
      expect(notification.show).toHaveBeenCalledTimes(1)
      expect(tray.setToolTip).toHaveBeenLastCalledWith(
        "SkillDrive Desktop - 1 pending review update"
      )
    } finally {
      controller.stop()
      vi.useRealTimers()
    }
  })
})
