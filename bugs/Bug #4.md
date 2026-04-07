Bug #4: 前端无差异化错误提示

位置:
- frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx:210-212

问题描述:

前端 handleDownload 将所有错误统一显示为"下载失败"，未区分不同错误类型（403、404、410、Network Error 等），导致用户体验不佳且难以排查问题。

```typescript
// 当前实现 (过于简单) - versions-tab.tsx:210-212
catch (err) {
    setError(err instanceof Error ? err.message : "下载失败")  // ← 直接显示后端消息
}
```

影响范围:
- 403 Permission denied → 应提示 "您没有权限下载此 Skill"
- 404 Not Found → 应提示 "Skill 或版本不存在"
- 410 Gone → 应提示 "该 Skill 已停用"
- Network Error → 应提示 "网络错误，请检查连接"

复现步骤:

1. 以普通 member 身份登录（RBAC 开启时）
2. 尝试下载一个 Skill
3. 预期: 显示 "您没有权限下载此 Skill"
4. 实际: 显示后端的原始英文错误信息 "Permission denied" 或其他不友好的消息

修复建议:

```typescript
const handleDownload = async (version?: string) => {
    setDownloadLoading(true)
    try {
        const result = await api.downloadSkill({ skill_uuid: skillUuid, version })
        const content = JSON.stringify(result, null, 2)
        const blob = new Blob([content], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `skill-${skillUuid.slice(0, 8)}-${result.version}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    } catch (err) {
        const message = err instanceof Error ? err.message : '下载失败'
        // 根据错误码提供更友好的提示
        if (message.includes('Permission denied') || message.includes('403')) {
            setError('您没有权限下载此 Skill')
        } else if (message.includes('not found') || message.includes('404')) {
            setError('Skill 或版本不存在')
        } else if (message.includes('DEACTIVATED') || message.includes('410')) {
            setError('该 Skill 已停用，无法下载')
        } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
            setError('网络错误，请检查网络连接')
        } else {
            setError(message)
        }
    } finally {
        setDownloadLoading(false)
    }
}
```
