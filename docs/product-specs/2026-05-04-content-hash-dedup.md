# Skill 内容指纹去重

## 背景

当前 skill 的版本号（`SKILL.md` frontmatter 中的 `version` 字段）不是必填项。大多数 skill 作者不填写 version，后端在上传时自动生成 `1.0.0` 或自动 bump patch 版本号。这导致：

1. **重复分发**：内容未变但版本号变了，桌面客户端误判为需要更新，触发无意义的重复分发。
2. **unknown 状态**：本地 SKILL.md 没有 version 字段时，pre-distribution check 显示 `unknown`，用户无法判断是否需要操作。
3. **版本号不可靠**：自动生成的版本号是伪信息，基于伪信息做字符串比较产生的 `in-sync` / `update` / `installed-newer` 等状态都不可信。

## 目标

1. 引入内容指纹（Content Hash）作为 skill 分发状态的判断依据，替代版本号字符串比较。
2. 将桌面客户端的 skill 同步状态简化为三态模型：`installed` / `not-installed` / `update`。
3. 消除 `unknown` 状态，消除基于不可靠版本号的降级警告。
4. 后端在创建版本时计算并存储 content hash，客户端 API 返回该值。

## 非目标

- 不改变 SKILL.md `version` 字段的非强制性质。
- 不移除后端的版本号体系和自动 bump 逻辑；版本号保留为内部排序和追溯用途。
- 不实现上传去重（内容相同时跳过创建新版本）；上传行为不变。
- 不在分发包中注入 version 或附加 manifest.json。
- 不改变 Web 控制台的 skill 管理界面行为。
- 不改变 `sync_public_skills.py` 的公共 skill 同步语义；只在其创建或补录版本记录时写入 content hash。

## 使用场景

1. 桌面客户端轮询远端 skill 列表，通过 content hash 判断本地已分发的 skill 是否与远端一致，避免内容未变时的重复分发。
2. 用户在桌面客户端的审核面板看到清晰的三态标签（已安装 / 未安装 / 可更新），不再看到 `unknown` 或 `v1.0.0 → v1.0.1` 这种不可靠的版本对比。
3. pre-distribution check 读取本地 agent 目录的 skill 内容，计算 hash 与远端比较，给出准确的安装状态。

## 受影响的面

| 面 | 变更类型 |
|------|---------|
| 后端 `skill_versions` 数据模型 | 新增 `content_hash` 字段 |
| 后端客户端 API 响应 | `ClientSkillSummaryResponse` 增加 `content_hash` |
| 后端公共 skill 同步脚本 | 版本记录创建/补录时填充 `content_hash`，同步语义不变 |
| 桌面客户端 API 归一化 | 将 `content_hash` 映射为 `RemoteSkillSummary.contentHash` |
| 桌面客户端 sync 比较逻辑 | `compareRemoteSkills()` 改用 content hash |
| 桌面客户端 State DB | 本地记录和 pending update 增加 content hash 字段，并兼容旧库 |
| 桌面客户端 agent adapter | 读取已安装 skill 时计算本地 content hash |
| 桌面客户端 pre-distribution check | 使用 hash 结果输出 `contentComparison` |
| 桌面客户端 UI | 状态标签从版本号对比改为三态标签 |

## 验收标准

- 后端创建 skill 版本时自动计算 content hash 并持久化到 `skill_versions.content_hash`。
- `sync_public_skills.py` 创建或补录公共 skill 版本时填充 `content_hash`，但不改变全量同步、单项导入、失活、自动快照版本递增语义。
- `GET /api/v1/client/skills` 返回的每个 skill 包含 `content_hash` 字段。
- Web 控制台现有 skill/version API 不新增 `content_hash` 字段。
- 桌面客户端旧 State DB 可被就地迁移，旧记录缺失 hash 时按兼容规则处理。
- 桌面客户端 `compareRemoteSkills()` 基于 content hash 判定状态，不再依赖版本号字符串比较。
- 同步状态只有三种：`installed`、`not-installed`、`update`。
- 内容未变但版本号变更的 skill 不再触发重复分发。
- 本地 SKILL.md 没有 version 字段时，pre-distribution check 通过目录 content hash 判定，不再显示 `unknown` 状态。
- 读取本地目录失败时仍可显示 `error`，该状态只表示检查失败，不属于同步三态模型。
- 已有 skill 版本的 content hash 通过一次性回填脚本补全。
- 现有 Web 控制台功能不受影响。
