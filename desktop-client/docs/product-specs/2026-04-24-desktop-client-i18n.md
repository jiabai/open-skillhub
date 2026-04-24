# Desktop Client i18n

> 状态：产品规格文档

## 目标

为 `desktop-client` 增加本地化支持，让 renderer UI 可以在 `zh-CN` 和 `en-US` 之间切换，并把语言偏好持久化到 desktop local config 中。

这个改动只覆盖桌面端 UI 文案、日期时间格式和语言偏好保存方式，不改变后端 API、Electron IPC contract 或同步/分发业务逻辑。

## 为什么需要这个功能？

当前 desktop-client 的界面文案基本都是硬编码英文。对中文用户来说，这会带来三个问题：

| 问题 | 影响 |
|------|------|
| UI 只有英文 | 中文用户理解成本高 |
| 语言偏好不持久化 | 每次启动都要重新适应界面 |
| 日期时间和界面语言不一致 | 视觉上不统一，容易产生误解 |

desktop-client 是一个单用户本地客户端，因此语言选择应该作为本地偏好配置保存，而不是依赖 cookie、请求头或服务端状态。

## 用户怎么用？

### 首次启动

```
1. 应用启动
2. 读取本地语言配置；如果没有保存过语言，则使用系统语言或默认语言
3. 界面以当前 locale 渲染
4. 用户可在 Settings 中切换语言
5. 切换后立即更新界面
6. 语言选择写入本地配置文件
```

### 后续启动

```
1. 应用启动
2. 读取上次保存的 locale
3. 直接用该 locale 渲染界面
4. 不需要用户重复设置
```

## 语言范围

本次只支持两种 locale：

- `zh-CN`
- `en-US`

locale 规范应与 frontend 保持一致：

- `zh-CN` 作为中文主语言
- `en-US` 作为英文主语言
- 不支持第三方翻译服务或自动机翻

## 信息架构

### i18n 核心

desktop-client 内部增加一套本地 i18n 运行时：

- locale 标准化与默认值解析
- 字典映射
- `I18nProvider` 和 `useI18n` hook
- 文案插值工具
- locale-aware 的日期时间格式化

### 配置持久化

语言偏好与 `apiBaseUrl` 一起保存在 desktop local config 中，由 Electron 主进程负责读写，renderer 通过 IPC 读取和更新。

### 设置入口

Settings 抽屉中增加语言切换入口。用户切换语言后，界面立即更新，不要求重启应用。

## 范围

本次包含：

- 新增 desktop-client i18n 基础设施
- 新增 `zh-CN` 和 `en-US` 翻译字典
- 让主界面、Settings、配置表单、活动日志、更新列表等 renderer 文案走 i18n
- 将 locale 偏好持久化到本地配置
- 让日期和时间显示跟随当前 locale
- 补充相关测试

## 非范围

本次不包含：

- 后端接口改造
- Electron IPC 扩展到与 i18n 无关的新能力
- 自动语言检测以外的个性化内容翻译
- 第三方 i18n 库引入
- 多账户或按用户维度保存不同语言

## 成功标准

用户能做到这些就算成功：

1. 打开 desktop-client 后，界面可以按当前 locale 正常显示。
2. Settings 中可以切换 `zh-CN` / `en-US`。
3. 切换语言后，界面立即更新。
4. 重新启动应用后，语言偏好仍然保持。
5. 日期时间显示跟随 locale。
6. 相关桌面端测试和构建通过。

## 相关文档

- 执行计划：`docs/exec-plans/active/2026-04-24-desktop-client-i18n.md`
- 桌面端架构：`docs/ARCHITECTURE.md`
- 桌面端设计：`docs/DESIGN.md`
- 桌面端任务追踪：`task-tracker.md`

