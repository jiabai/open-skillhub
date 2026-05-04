# 上传按钮标签简化

状态：本地规范产品文档，待实现

## 目的

简化本地 SKILL 页面中上传按钮的标签，使其只显示操作文字（"上传"）而不附带
SKILL 名称。每个 SKILL 行已经将 SKILL 名称显示为标题，在按钮内重复显示是
冗余的，并且使按钮宽度不必要地增大。

## 当前行为

在 `local-skills-view.tsx` 中，每个可上传 SKILL 行的上传按钮渲染：

```tsx
{isUploading ? copy.uploading : copy.upload(name)}
```

i18n 字符串为：

| 语言 | 当前值 |
|------|--------|
| en-US | `upload: (name: string) => `Upload ${name}`` |
| zh-CN | `upload: (name: string) => `上传 ${name}`` |

这会生成类似 "Upload my-skill" 或 "上传 my-skill" 的标签，而 SKILL 名称已经
作为行标题直接显示在按钮上方。

## 目标行为

上传按钮应只显示操作词：

| 语言 | 目标值 |
|------|--------|
| en-US | `upload: "Upload"` |
| zh-CN | `upload: "上传"` |

`uploading` 标签（"Uploading..." / "上传中..."）保持不变。

## 目标

- 移除两种语言中 `upload` i18n 字符串的 SKILL 名称参数。
- 将 i18n 类型定义中 `upload` 键从函数 `(name: string) => string` 改为
  普通 `string`。
- 更新组件，将 `copy.upload(name)` 改为 `copy.upload`。
- 保持 `uploading` 标签和 local-skills-view 的所有其他字符串不变。

## 非目标

- 不修改上传逻辑、IPC 流程或错误处理。
- 不修改其他视图或组件中在操作按钮内使用 SKILL 名称的部分（例如首页的
  "分发 {name}" 按钮）。
- 不修改 `local-skills-view.tsx` 的布局、样式或组件结构。

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/i18n/messages/types.ts` | 将 `upload: (name: string) => string` 改为 `upload: string` |
| `src/i18n/messages/en-US.ts` | 将 `upload: (name: string) => `Upload ${name}`` 改为 `upload: "Upload"` |
| `src/i18n/messages/zh-CN.ts` | 将 `upload: (name: string) => `上传 ${name}`` 改为 `upload: "上传"` |
| `src/components/local-skills-view.tsx` | 将 `copy.upload(name)` 改为 `copy.upload` |

## 验收标准

- 本地 SKILL 页面的上传按钮显示 "Upload"（en-US）或 "上传"（zh-CN），
  不附带 SKILL 名称。
- `uploading` 状态标签仍为 "Uploading..." / "上传中..."。
- `npm test` 通过。
- `npm run build` 通过。
- `python scripts/validate_agents_docs.py --level ERROR` 通过。
- `git diff --check` 通过。

## 参考

- 本地 SKILL 视图组件：`../../src/components/local-skills-view.tsx`
- i18n 类型定义：`../../src/i18n/messages/types.ts`
- 英文消息：`../../src/i18n/messages/en-US.ts`
- 中文消息：`../../src/i18n/messages/zh-CN.ts`
