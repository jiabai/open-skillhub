# 宿主机预发公共 Skill 单项导入 CLI 规格

## 背景

当前 `backend/scripts/sync_public_skills.py` 只支持扫描整个 `__system__` 目录，把其中的公共 Skill 一次性同步到数据库。对于宿主机上的预发环境，这种方式有两个问题：

- 不能只导入一个指定 Skill，操作粒度太粗
- 命令默认依赖容器路径约定，不够适合在宿主机直接运行

同时，前端的公共 Skills 页面已经存在，并且是否展示公共 Skills 由后端运行时能力 `public_skills` 决定。因此，这次需求的核心不是新增页面，而是把“宿主机可执行的单项导入”这条运维路径补齐。

## 目标

1. 允许在仓库根目录直接运行 `uv run python backend/scripts/sync_public_skills.py <skill_name>`，把指定 Skill 导入公共 Skills 空间。
2. 保留无参数的全量同步行为，用于现有的批量对账和失活缺失项逻辑。
3. 允许宿主机预发环境通过显式的存储根路径覆盖，避免脚本被容器内路径绑定。
4. 导入完成后，只要后端运行时能力开启了公共 Skills，前端即可展示该 Skill。

## 非目标

- 不新增新的 HTTP API
- 不改造公共 Skills 页面交互
- 不改变 Skill 数据模型、版本模型或公共/私有可见性语义
- 不把公共 Skill 导入做成普通 Skill 创建接口的一个可选参数

## 使用场景

1. 预发管理员在宿主机上准备好 Skill 文件，放到挂载目录中的 `./data/skills/__system__/demo-skill/`
2. 在仓库根目录执行导入命令
3. 前端公共 Skills 页面在后端能力开启后可以看到新导入的 Skill

## 约束

- 命令必须可以在宿主机执行，不要求进入 Docker 容器
- 目标 Skill 名称必须经过合法性检查，不能允许路径穿越或非法字符
- 单项导入不得影响其他已经存在的公共 Skills
- 全量同步必须保留当前“缺失即失活”的对账语义
- 前端展示仍然依赖后端运行时能力：`ENABLE_SKILL_VISIBILITY=true` 且 `ENABLE_RBAC=false`

## 验收标准

- 能通过宿主机命令导入单个指定 Skill
- 找不到目标 Skill、找不到 `SKILL.md` 或 Skill 名称非法时，会返回明确错误并以非零状态退出
- 单项导入不会失活其他公共 Skills
- 全量同步的现有行为不回退
- 可以通过命令退出码、后端存储、公开 Skills API 和前端页面四层确认导入成功
