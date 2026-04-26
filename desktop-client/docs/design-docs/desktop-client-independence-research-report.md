# Desktop Client 独立可行性分析报告

范围：`desktop-client/`

## Executive Summary

desktop-client 具备较高的独立性条件：零代码级依赖、独立的构建/测试链路、完整的自包含文档体系、仅通过 HTTP API 与后端交互。但它目前仍处于早期阶段（Electron 启动命令尚未规范化、secret-store 未接通、分发历史未持久化），且与主仓库共享品牌、API 合约和发布节奏。短期内独立收益有限，中期（v1 稳定后）是最佳拆分窗口。

## 1. 耦合度评估

### 1.1 代码依赖：零

desktop-client 对主仓库没有任何 import 或文件级依赖。搜索确认：

- 无 `import from "../"` 或 `import from "../../"` 等跨目录引用
- 无 `@skillhub` 或 `open-skillhub` 包引用
- 不使用 `shared/` 目录
- `package.json` 的依赖全部来自 npm 公共包（React、Electron、Vite、sql.js、keytar 等）
- TypeScript 路径别名 `@/` 映射到 `desktop-client/src/`，完全自包含

唯一的外部依赖是运行时 HTTP 调用后端 `/api/v1/client/skills` 和 `/api/v1/client/skills/download`，这是标准的 API 消费者关系。

### 1.2 构建链路：独立

| 维度 | desktop-client | 主仓库 |
|------|---------------|--------|
| 包管理 | npm + package-lock.json | UV (Python) + npm (frontend) |
| 构建 | `npm run build`（Vite + tsc） | docker compose / uvicorn |
| 测试 | Vitest | pytest (后端) / Vitest (前端) |
| 类型检查 | `tsconfig.node.json` | mypy (后端) / tsc (前端) |
| CI/CD | 无独立配置 | docker-compose.yml |

两者构建链路完全不交叉。docker-compose.yml 中也不包含 desktop-client 服务。

### 1.3 API 合约：松耦合

desktop-client 消费后端的两个专用端点：

- `GET /api/v1/client/skills` — 列出可下载技能，由 `ClientSkillCatalogService` 提供服务
- `POST /api/v1/client/skills/download` — 下载技能包，使用 API Token 认证

这是典型的 API 消费者关系，与前端 Web Console 消费后端 API 的模式完全一致。后端的 `client_skills.py` 路由和 `client_skill.py` schema 是为桌面客户端设计的专用接口，但它们是后端的内部实现，不是桌面客户端的代码。

API 响应的解析逻辑全部在 `electron/main.ts` 的 `normalizeSkillSummary` 和 `parseDownloadPayload` 中实现，使用了宽容的字段映射（支持多种命名风格），这表明合约变更时桌面客户端有一定容错能力。

### 1.4 文档体系：已独立

desktop-client 拥有完整的自包含文档：

- `AGENTS.md` — AI 代理入口，明确声明"默认作用域限于 desktop-client/"
- `docs/ARCHITECTURE.md` — 独立架构描述
- `docs/SECURITY.md` — 独立安全规则
- `docs/DESIGN.md` — 设计规则
- `docs/QUALITY_SCORE.md` — 质量追踪
- `docs/product-specs/` — 产品规格
- `docs/exec-plans/index.md` — 执行计划入口索引
- `docs/references/` — 参考文献
- `docs/generated/` — 生成文档
- `task-tracker.md` — 独立任务列表

历史性的跨仓库文档（`docs/superpowers/desktop-client*`）已在 2026-04-17 被清除，本地文档已是唯一真相源。

### 1.5 运行时环境变量

desktop-client 通过环境变量配置，所有变量都以 `OPEN_SKILLHUB_` 为前缀：

- `OPEN_SKILLHUB_API_BASE_URL`
- `OPEN_SKILLHUB_API_TOKEN`
- `OPEN_SKILLHUB_POLL_INTERVAL_MS`
- `OPEN_SKILLHUB_CODEX_SKILLS_PATH`
- `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH`
- `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH`

这些变量名暗示了品牌绑定，但技术上只是字符串常量，拆分时改名成本极低。

## 2. 独立拆分可行性分析

### 2.1 支持独立的论据

**技术独立性高**。代码零依赖、构建链零交叉、测试独立运行、文档自成体系——这四项指标全部满足独立项目的基本条件。当前 desktop-client 在主仓库中的定位更接近一个"独立子项目被放在了同一个目录下"，而非"与主仓库深度耦合的模块"。

**发布节奏可解耦**。后端和前端的发布通过 Docker 镜像管理，桌面客户端是本地安装的 Electron 应用，发布周期和渠道完全不同。桌面客户端的更新不影响服务端部署，反之亦然（只要 API 合约不变）。

**目标用户群体不同**。Web Console 面向 SaaS 管理员和运营者，桌面客户端面向本地 AI Agent 用户（Codex、Claude Code、Gemini CLI 的使用者）。两者的产品定位和使用场景差异显著。

**独立仓库可改善贡献者体验**。桌面客户端开发者只需 clone 一个小仓库，无需安装 Python 后端或 Next.js 前端。Issue、PR、CI 都可以独立管理。

### 2.2 不支持独立的论据

**项目成熟度不足**。`task-tracker.md` 和 active ExecPlan 显示核心功能仍有缺口：Electron 启动命令尚未规范化、secret-store 未接通、分发历史未持久化。在 v1 功能不稳定时拆分会增加协调成本。

**品牌和身份绑定**。项目名 "Open SkillHub Desktop"、环境变量前缀 `OPEN_SKILLHUB_`、后端 API 路径 `/api/v1/client/skills` 都暗示这是同一个产品族的组成部分。独立后需要重新思考命名和身份。

**API 合约同步成本**。虽然当前是松耦合，但后端的 `client_skills` 端点是专门为桌面客户端设计的。独立后，API 变更的协调需要跨仓库进行，可能出现一方修改了合约但另一方未及时适配的情况。

**共享的 README 引用**。主仓库的 `README.md` 和 `README-zh.md` 都引用了 desktop-client。独立后需要更新这些引用或移除相关段落。

**CI/CD 缺失**。desktop-client 目前没有独立的 CI 配置。独立后需要从零搭建，包括构建、测试、打包、发布的完整流水线。

## 3. 拆分路径建议

### 3.1 短期（当前 ~ v1 稳定）：保持现状

理由：项目处于早期，功能缺口仍多，拆分的组织成本大于收益。当前状态已足够独立（零代码依赖），开发体验已经很好。

建议：
- 保持 desktop-client 在主仓库中，但继续强化其内部独立性
- 优先完成 v1 的功能缺口（Electron 启动规范化、secret-store 接通、分发历史持久化）
- 在后端添加 API 合约版本号（如 `/api/v1/client/skills` 的响应中加入 `api_version` 字段），为未来跨仓库协调做准备

### 3.2 中期（v1 稳定后）：拆分为独立仓库

理由：v1 稳定后，API 合约冻结，发布节奏解耦的收益最大化，贡献者体验改善显著。

拆分步骤：
1. 创建独立仓库（如 `open-skillhub-desktop`）
2. 将 `desktop-client/` 的全部内容迁移，保留 git 历史
3. 更新主仓库 README 移除桌面客户端段落，改为链接
4. 在独立仓库中添加 CI/CD（GitHub Actions：构建 + 测试 + Electron 打包）
5. 建立 API 合约文档，记录 `/api/v1/client/skills` 的请求/响应格式
6. 考虑发布到 Electron 自动更新渠道

### 3.3 替代方案：Monorepo 工具链

如果不希望完全拆分，可以使用 Turborepo 或 Nx 等 monorepo 工具来管理：
- 每个子项目有独立的 `package.json` 和构建配置
- 共享 CI 缓存和依赖管理
- 保持代码在一个仓库，但获得类似独立仓库的开发体验

但考虑到主仓库是 Python 后端 + Next.js 前端的组合，引入 Node monorepo 工具的收益有限，且增加了技术栈复杂度。

## 4. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| API 合约不同步 | 中 | 高 | 添加合约版本号 + 变更日志 |
| 品牌认知混乱 | 低 | 低 | 使用统一的 GitHub Organization |
| 独立后 CI/CD 缺失 | 高 | 中 | 拆分前先搭建 CI |
| 发布节奏冲突 | 低 | 中 | 语义化版本 + 合约稳定性承诺 |

## 5. 结论

desktop-client 在技术层面已经具备独立出去的条件——代码零依赖、构建独立、文档自包含。但考虑到项目仍处于 v1 开发阶段，核心功能（Electron 启动规范化、secret-store 接通、分发历史持久化）尚未完成，短期内拆分的收益不足以覆盖组织成本。建议在 v1 功能稳定后再进行拆分，届时 API 合约冻结、发布节奏解耦的收益将最大化。当前阶段最实际的做法是继续维持现状，同时有意识地强化内部独立性，为未来拆分做好准备。

## References

1. [desktop-client/AGENTS.md](./desktop-client/AGENTS.md)
2. [desktop-client/docs/ARCHITECTURE.md](./desktop-client/docs/ARCHITECTURE.md)
3. [desktop-client/docs/SECURITY.md](./desktop-client/docs/SECURITY.md)
4. [desktop-client/package.json](./desktop-client/package.json)
5. [desktop-client/electron/main.ts](./desktop-client/electron/main.ts)
6. [backend/api/v1/client_skills.py](./backend/api/v1/client_skills.py)
7. [AGENTS.md (root)](./AGENTS.md)
