import { readFile } from "node:fs/promises"

export interface UploadLocalSkillPackageRequest {
  apiBaseUrl: string
  apiToken: string | null
  artifactPath: string
  fileName: string
  fetchImpl?: typeof fetch
}

export interface UploadedLocalSkillResponse {
  id: string | null
  name: string
  version: string | null
}

function joinApiUrl(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.replace(/\/+$/, "")}${path}`
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function createUploadErrorMessage(status: number, statusText: string, payload: unknown): string {
  const record = payload as Record<string, unknown>
  const code = normalizeString(record.code)
  const detail = normalizeString(record.detail) ?? `${status} ${statusText}`.trim()

  return code ? `${code}: ${detail}` : `Failed to upload local skill: ${detail}`
}

export async function uploadLocalSkillPackage(
  request: UploadLocalSkillPackageRequest
): Promise<UploadedLocalSkillResponse> {
  const apiToken = request.apiToken?.trim()

  if (!apiToken) {
    throw new Error("An Open SkillHub API token is required to upload local skills")
  }

  const fileBytes = await readFile(request.artifactPath)
  const formData = new FormData()
  formData.set("file", new Blob([fileBytes], { type: "application/zip" }), request.fileName)
  formData.set("visibility", "private")

  const fetchImpl = request.fetchImpl ?? fetch
  const response = await fetchImpl(joinApiUrl(request.apiBaseUrl, "/api/v1/client/skills/upload"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`
    },
    body: formData
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    throw new Error(createUploadErrorMessage(response.status, response.statusText, payload))
  }

  const name = normalizeString(payload.name)

  if (!name) {
    throw new Error("Client upload response is missing the uploaded skill name")
  }

  return {
    id: normalizeString(payload.id),
    name,
    version: normalizeString(payload.version) ?? normalizeString(payload.current_version)
  }
}
