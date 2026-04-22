# 公共 Skill 同步 CLI 设计说明

## 这份文档解决什么问题

这条命令是给宿主机上的预发环境用的。它的目标很直接：

- 可以从仓库根目录执行
- 可以只导入一个指定的 public skill
- 也可以继续保留原来的全量同步
- 不需要先进入 Docker 容器

当前仓库里的 `backend/scripts/sync_public_skills.py` 只有“整目录扫描”这一种行为。对日常预发运维来说，这不够方便，所以需要把命令的使用方式和边界单独说明清楚。

## 先看怎么用

最常见的三种用法如下：

```bash
uv run python backend/scripts/sync_public_skills.py
uv run python backend/scripts/sync_public_skills.py demo-skill
uv run python backend/scripts/sync_public_skills.py demo-skill --storage-root ./data/skills
```

含义分别是：

- 第一条：全量同步 `__system__` 下所有可用的 public skills
- 第二条：只导入 `demo-skill`
- 第三条：只导入 `demo-skill`，并显式指定宿主机上的 skill 根目录

## 行为规则

### 1. Skill 名称以目录名为准

系统认的是 `__system__/<skill-name>/` 这个目录名，不是 `SKILL.md` 里的 `name` 字段。

这样做的好处是：

- 命令参数和磁盘目录一一对应
- 不容易因为 `SKILL.md` 写错名字而导错目标
- 目录本身就是公开 skill 的唯一入口

### 2. 命令分两种模式

**全量同步**

- 不传 skill 名称时触发
- 会扫描 `__system__` 下所有合法 skill
- 会把磁盘上已经不存在的 public skill 失活

**单项导入**

- 传入一个 skill 名称时触发
- 只更新这个 skill
- 不会顺手失活其他 public skills

这两种模式不是重复功能，而是两种不同的运维动作：

- 全量同步适合做对账
- 单项导入适合做补录

### 3. 可以显式指定存储根目录

命令默认还是走 backend settings 里的 skill 存储路径。

但在宿主机预发环境里，通常更希望显式告诉脚本：

- public skills 的根目录在哪
- 这个根目录是宿主机 bind mount，而不是容器内路径

所以命令支持 `--storage-root`，让同一套逻辑同时适配：

- 容器内运行
- 宿主机运行
- bind mount 预发环境

### 4. 命令只管导入，不管展示开关

这个脚本只负责把 skill 写进后端系统空间。

它不会：

- 打开或关闭前端页面
- 修改 runtime capabilities
- 改变 `public_skills` 的启用状态

前端是否展示公共 Skills，仍然由后端运行时能力决定。也就是说，导入成功以后，前端还需要满足：

- `ENABLE_SKILL_VISIBILITY=true`
- `ENABLE_RBAC=false`

## 错误处理原则

单项导入时，下面这些情况都应该直接失败：

- skill 名称非法
- 目标目录不存在
- 目标目录里没有 `SKILL.md`

失败要尽量早，而且要明确。这样运维同学一眼就能知道是：

- 路径给错了
- 文件没放好
- skill 名称和目录不一致

全量同步则不一样。它会继续忽略一些无效目录，尽量把剩下能同步的 skill 都处理完。

## 和前端的关系

这个命令本身不改前端代码，但它会影响前端页面能看到什么。

链路是这样的：

1. 宿主机运行同步命令
2. 后端把 skill 写入 public skills 空间
3. 后端 runtime config 报告 `public_skills=true`
4. 前端公共 Skills 页面读取后端配置并展示内容

所以这份设计里最重要的一点是：

- **导入命令负责数据**
- **runtime config 负责是否展示**

## 如何确认导入成功

如果是在宿主机预发环境里做一次单项导入，建议按下面 4 步确认结果：

1. 先看命令是否成功退出。
   - `uv run python backend/scripts/sync_public_skills.py demo-skill --storage-root ./data/skills`
   - 退出码是 `0`，说明脚本本身没有报错
2. 再确认后端已经写入了目标 skill。
   - 目标记录应为 `visibility=public`
   - `is_active=true`
3. 再看公共 Skills API 能不能查到它。
   - `GET /api/v1/skills/public`
   - 结果里应该能看到刚导入的 skill
4. 最后确认前端确实能展示。
   - `GET /api/v1/runtime-config` 应该返回 `public_skills=true`
   - 公共 Skills 页面应该能看到同一个 skill

## 不做什么

为了避免边界变模糊，这个 CLI 明确不做下面这些事：

- 不新增 API
- 不把 public skill 当成普通 skill 创建接口的一个参数
- 不替代现有全量同步
- 不负责前端页面开关
- 不负责把宿主机路径写死成某一台机器的绝对路径

## 稳定约定

下面这些约定视为这个命令的长期契约：

- `__system__` 下的目录名就是 skill 名称
- 无参数时走全量同步
- 传 skill 名称时走单项导入
- 单项导入只影响目标 skill
- 全量同步保留“缺失即失活”的对账语义
- `--storage-root` 用来适配宿主机预发和其它非容器路径场景

## 什么时候需要回来看这份文档

如果以后要改这条命令，优先检查下面几件事有没有被破坏：

- 还能不能在宿主机上直接执行
- 单项导入会不会误伤其它 public skills
- 全量同步的失活行为有没有变
- 前端展示是否还依赖后端 runtime config
