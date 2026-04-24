# 客户端 Skills 仅返回私有空间技能

## 背景

当前 `GET /api/v1/client/skills` 使用“可见技能”语义返回结果。在 `ENABLE_RBAC=false` 且 `ENABLE_SKILL_VISIBILITY=true` 的环境里，这会把系统公共 Skills 也混入客户端列表里。

对于客户端场景，这个接口更像是“某个 API token 持有者自己的技能空间清单”，而不是全局公共目录浏览器。已经被引用或克隆进用户自己空间的技能应当保留，因为它们已经成为用户拥有的私有记录；未被引用或克隆的公共 Skills 不应出现在这个列表里。

## 目标

1. `GET /api/v1/client/skills` 只返回当前 API token 所属用户自己拥有的 Skill 记录。
2. 参考技能、克隆技能和用户自己创建的 Skill 仍然可以出现在结果里，因为它们都属于该用户的私有空间。
3. 未被引用、未被克隆、也不属于当前用户的公共 Skills 不再出现在客户端列表中。
4. `limit`、`skip` 和 `q` 的分页与过滤语义保持不变。

## 非目标

- 不改变公共 Skills 页面或公共 Skills API 的返回范围
- 不改变 `POST /api/v1/client/skills/download`
- 不改变 Skill 数据模型、版本模型或存储路径
- 不把客户端列表变成去重后的公共目录视图

## 使用场景

1. 桌面客户端使用 `GET /api/v1/client/skills?limit=1` 只做连接检测时，只要用户拥有任意一个私有空间 Skill，就能得到正常响应。
2. 客户端需要枚举用户自己的技能清单时，不会再看到没有落入自己空间的公共 catalog 条目。
3. 如果用户把某个公共 Skill 引用或克隆到自己的空间，这条技能会继续显示，因为它已经变成用户拥有的记录。

## 约束

- 接口认证仍然使用 API token
- 响应形状保持 `items` 和 `total`
- 条目字段保持现有 `ClientSkillSummaryResponse` 结构
- 该改动只收紧查询边界，不引入新的分页参数或去重逻辑

## 验收标准

- 仅存在公共 catalog 技能、但没有被当前用户引用或克隆时，客户端列表不返回这些技能
- 当前用户自己的 reference / clone / private Skill 会继续出现在客户端列表中
- `total` 与 `items` 都只反映当前用户自己拥有的 Skill 记录
- `GET /api/v1/client/skills?limit=1` 仍然可用于连接检测，但只会从用户自有空间里取样
