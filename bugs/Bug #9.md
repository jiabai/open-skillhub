Bug #9: 加密模式下前端用户体验不佳

位置:
- backend/services/skill.py:479-481 (加密分支)
- frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx:199-205 (保存逻辑)
- frontend/src/types/index.ts:136-143 (SkillDownloadResponse 类型定义)

问题描述:

当 ENABLE_SKILL_DOWNLOAD_ENCRYPTION=True 时，后端返回的是 AES-256-GCM 加密后的密文（Base64 编码）。前端直接将其保存为 .json 文件，用户拿到的是无法直接使用的加密数据。

用户视角的问题:
1. 下载文件名为 skill-xxxxxxxx-1.0.0.json，用户以为是普通 JSON 格式
2. 打开文件看到的是乱码（Base64 编码的密文字符串）
3. 没有任何提示告知用户文件已加密
4. 缺少解密工具、解密说明文档链接或引导

相关代码:

```python
# 后端 - services/skill.py:479-484
if settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION:
    encrypted_code, checksum = self._encrypt_payload(archive_bytes)  # 返回加密数据
else:
    encrypted_code = base64.b64encode(archive_bytes).decode("utf-8")  # 返回 Base64 数据
    checksum = self._checksum_payload(archive_bytes)

return {
    "skill_uuid": skill.id,
    "version": target_version,
    "encrypted_code": encrypted_code,  # 无论是否加密都叫 encrypted_code，容易混淆
    "checksum": checksum,
    "expires_at": expires_at,
    "cache_ttl_seconds": settings.SKILL_CACHE_TTL_SECONDS,
}
```

```typescript
// 前端 - versions-tab.tsx:199-205 (不区分加密/非加密)
const result = await api.downloadSkill({ skill_uuid: skillUuid, version })
const content = JSON.stringify(result, null, 2)  // 直接序列化整个响应
const blob = new Blob([content], { type: "application/json" })
const url = URL.createObjectURL(url)
link.download = `skill-${skillUuid.slice(0, 8)}-${result.version}.json`  // 统一 .json 后缀
```

影响范围:
- 用户下载加密文件后无法使用，产生困惑
- 可能误以为系统故障导致文件损坏
- 缺乏安全意识的情况下可能尝试手动"修复"文件

修复建议:

方案 A: 前端检测加密状态并提示
```typescript
const handleDownload = async (version?: string) => {
    setDownloadLoading(true)
    try {
        const result = await api.downloadSkill({ skill_uuid: skillUuid, version })
        
        // 检测加密状态（通过 cache-policy 接口预知，或根据响应特征判断）
        if (isEncryptedContent(result)) {
            // 方式 1: 提示用户并引导到解密工具页
            const confirmed = window.confirm(
                '该 Skill 已加密存储。\n' +
                '下载后的文件需要使用官方解密工具打开。\n\n' +
                '是否继续下载？'
            )
            if (!confirmed) return
            
            // 方式 2: 修改文件名标识加密状态
            link.download = `skill-${skillUuid.slice(0, 8)}-${result.version}.encrypted.json`
        }
        
        // ... 保存逻辑 ...
    }
}
```

方案 B: 后端响应中明确标识加密状态
```python
# services/skill.py 返回值增加字段
return {
    "skill_uuid": skill.id,
    "version": target_version,
    "encrypted_code": encrypted_code,
    "checksum": checksum,
    "expires_at": expires_at,
    "cache_ttl_seconds": settings.SKILL_CACHE_TTL_SECONDS,
    "encryption_enabled": settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION,  # ← 新增明确标识
    "decryption_hint_url": "/docs/decryption-guide" if settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION else None,  # 解密指南链接
}
```

方案 C: 根据加密状态返回不同格式
```python
# 非加密模式：直接返回 ZIP 文件流（浏览器自动下载）
if not settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION:
    from fastapi.responses import Response
    return Response(
        content=archive_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{name}-{version}.zip"'}
    )

# 加密模式：返回 JSON（包含密文和解密说明）
return {"encrypted_code": ..., "checksum": ..., ...}
```
