Bug #8: 前端缺少取消下载功能

位置:
- frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx:194-215

问题描述:

一旦点击下载按钮，用户无法取消正在进行的请求。对于大文件下载场景用户体验较差，用户只能等待请求完成或关闭浏览器标签页。

```typescript
// 当前实现 - versions-tab.tsx:195-214
const handleDownload = async (version?: string) => {
    setDownloadLoading(true)  // ← 设置加载状态
    try {
        const result = await api.downloadSkill({ skill_uuid: skillUuid, version })  // ← 无法中断
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
        setError(err instanceof Error ? err.message : "下载失败")
    } finally {
        setDownloadLoading(false)
    }
}
```

影响范围:
- 用户误操作后无法撤销，必须等待完成或关闭页面
- 大文件下载时用户无法切换到其他操作（如选择其他版本）
- 网络慢时用户焦虑感增加

修复建议:

使用 AbortController 实现可取消的下载：
```typescript
import { useRef } from "react"

// 在组件内添加 ref
const downloadControllerRef = useRef<AbortController | null>(null)

const handleDownload = async (version?: string) => {
    const controller = new AbortController()
    downloadControllerRef.current = controller
    setDownloadLoading(true)
    setError(null)
    
    try {
        const result = await api.downloadSkill({ 
            skill_uuid: skillUuid, 
            version,
            signal: controller.signal  // ← 传入取消信号
        })
        
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
        if ((err as Error).name === 'AbortError') {
            console.log('Download cancelled by user')
            return
        }
        setError(err instanceof Error ? err.message : '下载失败')
    } finally {
        setDownloadLoading(false)
        downloadControllerRef.current = null
    }
}

// 取消函数
const handleCancelDownload = () => {
    if (downloadControllerRef.current) {
        downloadControllerRef.current.abort()
    }
}

// UI 中添加取消按钮（在下载进行中时显示）
{downloadLoading && (
    <Button variant="ghost" size="sm" onClick={handleCancelDownload}>
        取消
    </Button>
)}
```

同时需要在 API 封装层支持 AbortSignal：
```typescript
// frontend/src/lib/api.ts - 修改 fetchJson 函数
const fetchJson = async (path: string, options: ApiRequestOptions = {}): Promise<ApiResponse> => {
    const { skipRefresh: _skipRefresh, accessToken, signal, ...requestOptions } = options
    // ...
    const response = await fetch(`${apiBaseUrl}${path}`, { 
        ...requestOptions, 
        headers,
        signal  // ← 传递 AbortSignal
    })
    // ...
}
```
