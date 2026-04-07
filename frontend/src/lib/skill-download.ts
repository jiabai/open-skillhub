import { ApiError } from "@/lib/api"
import type { SkillDownloadResponse } from "@/types"

export function getDownloadErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "下载已取消"
  }
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "您没有权限下载此 Skill"
    }
    if (error.status === 404) {
      return "Skill 或版本不存在"
    }
    if (error.status === 410 || error.code === "SKILL_DEACTIVATED") {
      return "该 Skill 已停用，无法下载"
    }
    if (error.status === 413) {
      return "下载内容过大，浏览器已拒绝此次下载"
    }
    if (error.status === 429 || error.code === "RATE_LIMIT_EXCEEDED") {
      return "下载过于频繁，请稍后重试"
    }
    if (error.status >= 500) {
      return "下载失败，请稍后重试"
    }
    return error.message || "下载失败"
  }
  if (error instanceof TypeError) {
    return "网络错误，请检查连接后重试"
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "下载已取消"
    }
    return error.message || "下载失败"
  }
  return "下载失败"
}

export function buildSkillDownloadArtifact(result: SkillDownloadResponse, skillUuid: string, rawText?: string) {
  return {
    filename: result.download_filename || `skill-${skillUuid.slice(0, 8)}-${result.version}.json`,
    content: rawText ?? JSON.stringify(result),
    contentType: "application/json",
    confirmMessage: result.encryption_enabled
      ? result.decryption_hint || "该 Skill 下载内容已加密，下载后需要使用官方解密工具处理。是否继续？"
      : null,
  }
}
