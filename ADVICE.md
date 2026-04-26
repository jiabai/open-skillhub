# Open SkillHub 执行门禁方案最终版

## 结论

Open SkillHub 已经有清晰的工作流和文档结构，但还缺少一份面向“任务完成前必须检查什么”的统一标准。建议新增 `docs/EXECUTION_GATES.md`，把每次开发、修复和文档变更的完成标准固定下来；随后再逐步把这些标准接入脚本和 CI。

这份方案的核心原则是：**门禁先成为团队共识，再逐步自动化；已经能验证的项可以立刻成为硬门禁，尚未配置工具的项只能先作为建议或后续建设项。**

## 现状判断

仓库当前已经具备这些基础：

1. `WORKFLOW.md` 已定义五阶段流程：Constitution、Spec、Plan、Tasks、Implementation。
2. `AGENTS.md` 已要求非平凡任务遵循 `WORKFLOW.md`，并把重要文档入口集中在 Quick Entry。
3. `scripts/validate_agents_docs.py` 可以验证核心文档入口、索引引用和 `desktop-client/task-tracker.md` 格式。
4. `docs/QUALITY_SCORE.md` 已作为长期质量趋势记录。
5. 各子项目已有常用验证命令，例如后端 `uv run pytest`、`uv run ruff check .`，前端 `npm run lint` / `npm test`，桌面端 `npm test` / `npm run build`。

当前缺口也很明确：

1. 没有统一的 Definition of Done。
2. 没有一个文件说明“代码改动、文档改动、架构改动分别必须跑哪些检查”。
3. `validate_agents_docs.py` 只验证文档结构，不验证测试、lint、typecheck 是否通过。
4. 代码覆盖率阈值、安全扫描等工具尚未形成项目级配置，因此现在不能把它们写成硬性阻断门禁。
5. Active ExecPlan、task checklist 和实际代码变更之间的同步要求还不够集中。

因此，最稳妥的方向不是马上写一个试图覆盖所有场景的自动脚本，而是先建立一份项目认可的执行门禁文档，再把其中可自动化的部分逐步脚本化。

## 目标文件

建议新增：

```text
docs/EXECUTION_GATES.md
```

并同步更新：

1. `AGENTS.md`：在 Quick Entry 中加入 `docs/EXECUTION_GATES.md`。
2. `WORKFLOW.md`：在 Stage 5 “Implement and Validate” 中引用执行门禁。
3. `scripts/validate_agents_docs.py`：把 `docs/EXECUTION_GATES.md` 加入 `ROOT_REQUIRED_PATHS`，确保入口文件不会丢失。

不建议把门禁细则直接塞进 `AGENTS.md`。`AGENTS.md` 应继续保持为入口地图，详细规则放进 `docs/EXECUTION_GATES.md`。

## 门禁分级

执行门禁分为三类：

### 1. 硬门禁

硬门禁是任务完成前必须满足的条件。失败时，任务不得标记为 Done，不得声称“完成”。

当前适合作为硬门禁的内容：

- 相关测试通过。
- 相关 lint 或 typecheck 通过。
- 文档结构验证通过：`python scripts/validate_agents_docs.py --level ERROR`。
- 如果任务属于 active ExecPlan，ExecPlan 的 Progress / Decision Log 已更新。
- 如果改动影响架构、安全、流程或运行时契约，相关文档已同步更新。

### 2. 软门禁

软门禁是强烈建议执行的检查。失败或无法执行时，必须在最终说明或 ExecPlan 中记录原因，但不一定阻断任务完成。

当前适合作为软门禁的内容：

- 更广范围的回归测试。
- 手动验证步骤。
- 安全扫描，例如 `pip-audit`、`npm audit`。这些工具尚未形成项目级配置前，不应直接作为硬门禁。
- 覆盖率报告。项目已有 pytest-cov 依赖痕迹，但还没有统一覆盖率阈值，因此暂不作为硬门禁。

### 3. 建设项

建设项不是当前任务的完成条件，而是后续提升工程约束的工作。

建议建设项：

- 新增 `scripts/check_execution_gates.py`，统一调度各区域检查。
- 在 CI 中运行文档验证和区域验证命令。
- 为后端、前端、桌面端分别明确覆盖率统计方式和最低阈值。
- 统一记录门禁结果，减少“我本地跑过但无人可见”的情况。

## 按改动范围选择验证命令

门禁不应要求每个小改动都跑全仓库所有检查。更合理的规则是：**先跑受影响区域的最小有效验证，再根据风险扩大范围。**

### 后端改动

适用范围：`backend/`、`tests/`、后端迁移、后端 API 契约、后端服务逻辑。

必跑：

```bash
uv run pytest
uv run ruff check .
uv run mypy backend
python scripts/validate_agents_docs.py --level ERROR
```

如果只是后端文档或局部测试修复，可以先跑更窄的 pytest；但完成前至少要说明是否跑过全量 pytest，以及未跑的原因。

### 前端控制台改动

适用范围：`frontend/`。

必跑：

```bash
cd frontend && npm run lint
cd frontend && npm test
```

如果改动影响构建、路由、Next 配置或运行时环境，也应运行：

```bash
cd frontend && npm run build
```

### 桌面客户端改动

适用范围：`desktop-client/`。

必跑：

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
```

说明：`npm run build` 已包含 Electron typecheck 和构建步骤；如果需要更快的局部检查，可以先跑：

```bash
cd desktop-client && npm run typecheck:electron
```

但最终完成前仍建议跑 `npm test` 和 `npm run build`。

### 文档改动

适用范围：`AGENTS.md`、`WORKFLOW.md`、`docs/`、`desktop-client/docs/`、设计文档、产品规格、ExecPlan。

必跑：

```bash
python scripts/validate_agents_docs.py --level ERROR
```

如果文档描述了代码行为或运行时契约，还必须核对对应代码路径，避免把目标设计写成已实现事实。

### 跨区域改动

如果一次任务同时改动后端、前端和桌面端，必须分别执行对应区域的门禁。跨区域契约变更还应补充产品规格、架构文档或引用文档。

## Definition of Done

一个任务只有在满足以下条件后，才可以称为完成：

1. 需求或问题已经被实现、修复或明确记录为不做。
2. 受影响区域的硬门禁已经通过。
3. 相关文档已经同步更新，或者明确说明无需更新。
4. 如果任务属于 active ExecPlan，计划中的 Progress、Decision Log、验证记录已经更新。
5. 如果产生新的技术债，已经记录到对应 ExecPlan 或 `docs/exec-plans/tech-debt-tracker.md`。
6. 如果存在未执行的建议检查，最终说明中要写清楚原因和风险。

## 轻量路径规则

`WORKFLOW.md` 已允许低风险小改动走轻量路径。执行门禁应与这个规则保持一致。

轻量路径可以豁免：

- 新建 product spec。
- 新建 ExecPlan。
- 人工审查暂停点。
- 大范围回归测试。

轻量路径不能豁免：

- 与改动直接相关的验证。
- 文档结构验证。
- 对实际改动结果的清楚说明。

例如，修正文档链接时不需要跑后端 pytest，但必须跑 `python scripts/validate_agents_docs.py --level ERROR`。修一个桌面端组件 bug 时不需要新建 spec，但至少应跑桌面端相关测试；如果组件可能影响构建，还应跑 `npm run build`。

## 与现有文件的关系

### 与 `WORKFLOW.md`

`WORKFLOW.md` 规定做事流程，`docs/EXECUTION_GATES.md` 规定完成前检查什么。两者不重复：前者回答“任务怎么推进”，后者回答“什么时候可以收尾”。

### 与 `AGENTS.md`

`AGENTS.md` 继续作为入口地图。它只需要增加 `docs/EXECUTION_GATES.md` 链接，不应承载完整门禁细则。

### 与 `scripts/validate_agents_docs.py`

该脚本继续负责文档结构验证。它不应该被描述为会验证测试、lint 或 typecheck。若需要统一执行代码门禁，应新增独立脚本，例如 `scripts/check_execution_gates.py`。

### 与 `docs/QUALITY_SCORE.md`

`docs/QUALITY_SCORE.md` 是长期质量趋势记录，不是单次任务的阻断条件。`docs/EXECUTION_GATES.md` 是单次任务收尾前的执行标准。两者互补，不应互相替代。

## 自动化路线

建议分三步推进。

第一步：文档化门禁。

- 新增 `docs/EXECUTION_GATES.md`。
- 更新 `AGENTS.md`、`WORKFLOW.md` 和 `scripts/validate_agents_docs.py`。
- 让所有后续任务在最终说明中报告执行过的门禁。

第二步：脚本化可确定的检查。

- 新增 `scripts/check_execution_gates.py`。
- 支持按区域运行，例如 `--area backend`、`--area frontend`、`--area desktop-client`、`--area docs`。
- 先集成已经稳定存在的命令，不把未配置的覆盖率或安全扫描写成阻断项。

第三步：接入 CI。

- PR 或合并前运行文档验证。
- 按变更路径运行对应区域检查。
- 等覆盖率和安全扫描工具配置稳定后，再把它们升级为硬门禁。

## 推荐的 `docs/EXECUTION_GATES.md` 结构

建议文件包含以下章节：

```markdown
# Execution Gates

## Purpose

## Gate Levels

## Definition of Done

## Area-Specific Gates

### Backend

### Frontend Console

### Desktop Client

### Documentation

## Lightweight Path

## Failure Handling

## Reporting Format
```

其中 “Reporting Format” 可以要求每次任务最终说明至少包含：

```text
验证：
- 通过：<命令或检查项>
- 未运行：<命令或检查项>，原因：<原因>
- 剩余风险：<如无则写无>
```

## 最终建议

本方案建议立即落地 `docs/EXECUTION_GATES.md`，但不要一开始就追求“所有检查全自动、全阻断”。当前仓库最需要的是一个稳定、清晰、不会过度承诺的完成标准：

- 代码变更必须有对应验证。
- 文档变更必须通过文档结构验证。
- 非平凡任务必须保持 spec、plan、task、实现之间的一致性。
- 未运行的检查必须透明记录。

这样既能补上“任务完成标准”缺口，又不会把尚未配置的工具包装成已经存在的强制能力。
