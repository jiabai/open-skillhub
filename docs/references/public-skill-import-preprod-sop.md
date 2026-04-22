# 预发导入公共 Skill SOP

适用场景：在宿主机上的测试预发 overlay 中，把一个已经放在 `./data/skills/__system__/<skill-name>/` 的公共 Skill 导入系统，并让前端展示出来。

## 前置条件

- 已启动测试预发环境：
  ```bash
  docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build migrate api webui
  ```
- `backend/.env` 里 `ENABLE_SKILL_VISIBILITY=true`
- 目标目录里至少有 `SKILL.md`
- `NEXT_PUBLIC_API_BASE_URL` 必须是浏览器可访问的 origin，不要用 `0.0.0.0`

## 导入命令

```bash
uv run python backend/scripts/sync_public_skills.py <skill-name> --storage-root ./data/skills
```

- 只传 `skill-name` 时，只导入这一个 Skill
- 省略 `skill-name` 时，会退回到全量同步
- `--storage-root` 只影响读取来源目录，不会把宿主机路径写进数据库

## 验证结果

1. 命令退出码为 `0`
2. 数据库里该 Skill 为 `visibility=public` 且 `is_active=true`
3. `GET /api/v1/skills/public` 能查到该 Skill
4. `GET /api/v1/runtime-config` 返回 `public_skills=true`
5. 前端公共 Skills 页面可见

## 常见失败

- 找不到 Skill：确认路径是 `./data/skills/__system__/<skill-name>/`
- 前端不显示：确认 `ENABLE_SKILL_VISIBILITY=true`，并重新构建前端
- API 地址不对：不要把 `NEXT_PUBLIC_API_BASE_URL` 设成 `0.0.0.0` 或 `http://api:8001`
