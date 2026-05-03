# 部署指南

## 适用范围

本文档面向当前仓库结构下，基于 Docker Compose 的 Linux 部署。

默认假设：

- 后端运行在 `8001` 端口
- Web UI 在 Docker 内运行于 `3000` 端口，并映射到宿主机 `127.0.0.1:3000`
- 由外部 Nginx 反向代理统一对外提供 `80` 或 `443`
- Web UI 通过公网前端域名下的 `/api/*` 访问后端
- Next.js 通过 `API_INTERNAL_URL` 将 `/api/*` 重写到容器内后端

## 重要说明

### 1. 后端镜像使用多阶段构建

`backend/Dockerfile` 将依赖安装和运行镜像分离：

- `builder` 负责使用 `uv` 安装锁定依赖
- `runtime` 只保留 `/app/.venv`、后端代码和运行目录

构建阶段会把 `uv` 缓存挂载到 `/tmp/uv-cache`，只要 Docker BuildKit 缓存还在，后续重建通常会复用下载结果。

这意味着：

- 首次执行 `docker compose up -d --build migrate api webui` 时，在低配机器上仍可能需要几分钟，因为要先构建镜像并下载 Python 依赖
- 之后的重建通常会快很多，除非 `pyproject.toml`、`uv.lock` 发生变化，或者 Docker 构建缓存被清空

### 2. `uv.lock` 必须和包源保持一致

当前 compose 文件会传入：

```env
UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
```

如果 `uv.lock` 里仍然指向 `pypi.org` 或 `files.pythonhosted.org`，即使设置了 `UV_DEFAULT_INDEX`，`docker compose build migrate` 在受限网络或慢网络下依然可能卡住。

在中国大陆或类似网络环境中，建议在重建前按当前镜像源重新生成一次锁文件：

```bash
UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple uv lock
```

可以用下面的命令确认锁文件里已经不再引用上游 PyPI：

```bash
grep -n "pypi.org/simple\\|files.pythonhosted.org" uv.lock | head
```

### 3. Web UI 的公网 API 地址是构建时参数

`NEXT_PUBLIC_API_BASE_URL` 会在前端构建时写入产物。

本地开发或仅限本机访问时，测试预发覆盖层可以保持 `http://127.0.0.1:3000`。

如果是预发或任何浏览器要直接访问的环境，就必须填浏览器实际打开的公网 origin。对这台机器来说，就是 `http://39.107.59.41`。

不要使用 `0.0.0.0`，它只是监听地址，不是浏览器可访问的 origin。也不要填 Docker 内部地址，例如 `http://api:8001`。

如果修改了这个值，需要重新构建前端镜像。

### 4. 内部 API 地址只在 Docker 网络内使用

保持：

```env
API_INTERNAL_URL=http://api:8001
```

它只用于前端容器内的 Next.js 服务端重写。

### 5. 默认 Compose 使用 named volume，测试预发覆盖层使用宿主机 bind mount

默认 compose 文件使用 [docker-compose.yml](/D:/Github/open-skillhub/docker-compose.yml) 里的 Docker named volume，因此不需要宿主机上的 `./data` 或 `./logs` 目录。

测试预发覆盖层则会改成以下宿主机相对目录映射：

- `./data` -> `/app/data`
- `./logs` -> `/app/logs`
- `./backend` -> `/app/backend`
- `./frontend` -> `/workspace/frontend`

在覆盖层模式下：

- SQLite 数据库位于 `./data/skillhub.db`
- skill 文件位于 `./data/skills`
- API 日志位于 `./logs/api.log`
- 后端代码会通过 `uvicorn --reload` 自动重载
- 前端代码会通过 `next dev` 自动热更新
- 如果宿主机用户不是 `1000:1000`，可以用 `LOCAL_UID` 和 `LOCAL_GID` 覆盖容器运行用户

仓库里提供了一个模板文件 [.env.preprod.example](/D:/Github/open-skillhub/.env.preprod.example)。你可以先复制成本地 `.env.preprod`，再用 `docker compose --env-file .env.preprod ...` 启动测试预发覆盖层。

### 5.1 测试预发覆盖层下的宿主机公共 Skill 导入

当测试预发覆盖层启用后，宿主机上的 skill 文件位于 `./data/skills`，因此可以不进入容器，直接在宿主机执行公共 Skill 导入。

如果你只想照最短步骤操作，直接看 [预发导入公共 Skill SOP](/D:/Github/open-skillhub/docs/references/public-skill-import-preprod-sop.md)。

先在宿主机准备 skill 目录：

```bash
mkdir -p ./data/skills/__system__/demo-skill
```

然后在仓库根目录执行单项导入或全量对账：

```bash
uv run python backend/scripts/sync_public_skills.py demo-skill --storage-root ./data/skills
uv run python backend/scripts/sync_public_skills.py --storage-root ./data/skills
```

行为说明：

- 传入 `demo-skill` 时，只导入这一个 public skill，不会失活其他 public skills
- 不传 skill 名称时，执行历史上的全量同步，并会把磁盘上已缺失的 public skills 设为 inactive
- `--storage-root` 只影响导入时读取文件的来源目录；数据库中保存的 `skill_dir` 仍然以 backend settings 为准，这样容器内运行时路径不会被宿主机路径污染

单项导入后，建议按下面 4 步确认成功：

1. 命令退出码为 `0`
2. 目标 skill 在后端存储中为 `visibility=public` 且 `is_active=true`
3. `GET /api/v1/skills/public` 可以查到该 skill
4. `GET /api/v1/runtime-config` 返回 `public_skills=true`，并且前端公共 Skills 页面能看到同一个 skill

### 5.2 生产 Docker 部署下的公共 Skill 导入

生产环境使用默认 `docker-compose.yml` 时，数据存储在 Docker named volume 中，宿主机无法直接访问技能文件目录。此时有两种方式导入公共 Skill：

**方式一：使用 `--docker` 标志（推荐）**

脚本支持 `--docker` 标志，会自动通过 `docker compose exec` 在 API 容器内执行同步：

```bash
uv run python backend/scripts/sync_public_skills.py --docker demo-skill
uv run python backend/scripts/sync_public_skills.py --docker
```

如果 API 服务名不是默认的 `api`，可以通过 `--docker-service` 指定：

```bash
uv run python backend/scripts/sync_public_skills.py --docker --docker-service open-skillhub-api demo-skill
```

**方式二：手动进入容器执行**

```bash
docker compose exec api python backend/scripts/sync_public_skills.py demo-skill
docker compose exec api python backend/scripts/sync_public_skills.py
```

无论哪种方式，都需要先将技能文件放入容器的 `/app/data/skills/__system__/` 目录下。可以通过 `docker compose cp` 命令将宿主机上的技能目录复制到容器中：

```bash
docker compose cp ./local-skill/. api:/app/data/skills/__system__/demo-skill/
```

### 6. 前端业务能力以服务端运行时配置为准

前端不再单独维护一套业务开关。
前端通过以下接口读取运行时能力：

- `/api/v1/runtime-config`

因此 Linux 部署时，只需要保证后端环境变量正确，不需要再额外同步一套前端业务开关。

### 7. 共享用户状态 catalog 采用“构建前同步”，不是运行时直接读取根目录 `shared/`

`shared/user-statuses.json` 是唯一编辑源，但运行时实际消费的是各子项目内已提交的本地副本：

- backend：`backend/domain/user-statuses.json`
- frontend：`frontend/src/generated/user-statuses.json`

在 Docker 构建、发布打包或 CI 校验前，请执行：

```bash
python scripts/sync_shared_catalogs.py --check
```

如果你确实修改了 `shared/user-statuses.json`，请先重新生成本地副本：

```bash
python scripts/sync_shared_catalogs.py --write
```

## 推荐的 Compose 部署方式

当前仓库内的 Compose 文件默认面向“宿主机 Nginx 反向代理”布局：

- `migrate` 负责执行一次 Alembic 迁移，成功后退出
- `webui` 只发布到宿主机 `127.0.0.1:3000`
- `api` 只在 Docker 网络内部暴露 `8001`
- 宿主机上的 Nginx 负责把公网请求代理到 `127.0.0.1:3000`

如果你需要让后端直接对外提供机器访问，再额外给 `api` 增加宿主机端口映射。

### 1. 准备后端环境变量

```bash
cp backend/.env.example backend/.env
```

至少要修改：

- `SECRET_KEY`
- `DEBUG=false`
- `LOG_LEVEL=INFO`
- `CORS_ORIGINS`
- 如果使用 PostgreSQL，则还要更新 `DATABASE_URL`

示例：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. 准备仓库内目录

只在使用测试预发覆盖层时需要创建这些目录：

```bash
mkdir -p ./data ./logs
```

请在仓库根目录执行这条命令，然后准备覆盖层专用的本地环境变量文件：

```bash
cp .env.preprod.example .env.preprod
```

如果你的部署用户不是 UID/GID `1000:1000`，请在启动覆盖层前把 `.env.preprod` 里的 `LOCAL_UID` 和 `LOCAL_GID` 改成宿主机用户的值。

### 3. 设置 Web UI 的公网访问地址

构建镜像前，先确认同步后的 catalog 仍然一致：

```bash
python scripts/sync_shared_catalogs.py --check
```

默认 Compose 或测试预发覆盖层都要把 `NEXT_PUBLIC_API_BASE_URL` 设成浏览器实际访问的前端地址。覆盖层里的 `.env.preprod` 可以默认用 `http://127.0.0.1:3000` 仅供本机访问；如果是预发或通过公网 IP / 域名访问，就改成实际公网 origin，例如这台机器的 `http://39.107.59.41`。

不要使用 `0.0.0.0`，它只是监听地址，不是浏览器可访问地址。也不要填 Docker 内部地址，例如 `http://api:8001`。

`API_INTERNAL_URL=http://api:8001` 继续只用于前端容器里的 Next.js 服务端重写。

这样浏览器会访问前端公网地址，然后由 Next.js 转发到后端容器。

### 4. 配置 Nginx 反向代理

示例配置位于 [deploy/nginx/skillhub.conf](/D:/Github/open-skillhub/deploy/nginx/skillhub.conf)。

核心路由方式：

- 公网 `/` -> `127.0.0.1:3000`
- 浏览器 `/api/*` -> 前端域名
- 前端服务端重写 `/api/*` -> `http://api:8001`

示例：

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 5. 按需设置后端 CORS

如果浏览器流量都通过前端域名和 `/api` 代理走，CORS 的重要性会降低很多。

但为了稳妥，仍建议在 `backend/.env` 里把你的公网前端地址加入 `CORS_ORIGINS`，例如：

```env
CORS_ORIGINS=["http://YOUR_SERVER_IP","https://YOUR_DOMAIN"]
```

不要把无关的公网 IP 留在生产配置里。

### 6. 启动迁移和服务

默认 Compose 的推荐启动顺序：

```bash
docker compose up -d --build migrate api webui
```

这套默认基线会把日志留在 Docker 里，并使用 base compose 里的 named volume。

如果你要使用测试预发的热重载覆盖层，请改用：

```bash
mkdir -p ./data ./logs
cp .env.preprod.example .env.preprod
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build migrate api webui
```

如果你的 Compose 版本不支持 `depends_on.condition: service_completed_successfully`，可以使用备用方案：

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml run --rm migrate
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d api webui
```

注意：`docker compose up api` 会先等待 `migrate` 成功完成，因为 `api` 显式依赖 `migrate`。这属于正常行为，不会重复执行已经完成的 revision。

### 7. 验证

默认 Compose 基线下，在服务器上执行：

```bash
docker compose config
docker compose ps
docker compose logs api --tail 50
docker compose logs webui --tail 50
docker compose exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/readyz', timeout=5).read().decode())"
```

测试预发覆盖层下，使用同样的检查命令加上 `-f docker-compose.yml -f docker-compose.dev.yml`，然后再看宿主机目录：

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml config
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml ps
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml logs api --tail 50
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml logs webui --tail 50
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/readyz', timeout=5).read().decode())"
ls -l ./data
ls -l ./logs
tail -n 50 ./logs/api.log
```

在浏览器中：

- 打开 `http://YOUR_SERVER_IP`
- 或打开 `https://YOUR_DOMAIN`

确认：

- 登录页能正常加载
- `/api/v1/runtime-config` 能通过前端域名返回
- 技能页和审计页没有能力开关不一致的问题

## 测试机热重载

此模式仅适用于 Linux 测试机，用于在修改源码后无需重建容器即可自动重载。

覆盖文件 [docker-compose.dev.yml](/D:/Github/open-skillhub/docker-compose.dev.yml) 不会修改默认的 [docker-compose.yml](/D:/Github/open-skillhub/docker-compose.yml)，而是将运行行为切换为：

- 后端源码 bind mount + `uvicorn --reload`
- 前端源码 bind mount + `next dev`
- 与默认部署相同的反向代理入口路径
- 依赖变更和数据库迁移需要手动处理

### 1. 配置开发模式的公网前端地址

开发覆盖文件建议默认为：

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
API_INTERNAL_URL=http://api:8001
```

请先把 [.env.preprod.example](/D:/Github/open-skillhub/.env.preprod.example) 复制成 `.env.preprod`；如果你的测试机使用不同的公网 IP 或域名，再修改其中的 `NEXT_PUBLIC_API_BASE_URL`。

### 2. 启动或刷新热重载环境

```bash
mkdir -p ./data ./logs
cp .env.preprod.example .env.preprod
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build migrate api webui
```

此命令使用仓库内相对路径的 bind mount 挂载 `data/`、`logs/`、`backend/` 和 `frontend/`，因此整个开发环境可以跟随仓库路径移动。如果宿主机用户不是 `1000:1000`，请相应调整 `.env.preprod` 里的 `LOCAL_UID` 和 `LOCAL_GID`。

### 3. 数据库变更时手动运行迁移

热重载模式不会自动执行 Alembic 迁移。当你拉取了迁移变更或更新了需要迁移的后端模型时，请运行：

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml run --rm migrate
```

开发覆盖文件会把 `backend/` bind mount 到迁移容器中，因此新拉取的 Alembic 文件无需重建后端镜像即可被识别。

### 4. 了解何时仍需重建

纯源码变更在 `git pull` 后应该自动重载。

如果你修改了 `shared/user-statuses.json`，请先在宿主机执行 `python scripts/sync_shared_catalogs.py --write`，把 `backend/domain/` 和 `frontend/src/generated/` 下的运行时副本刷新后，再做重建或热重载验证。

当依赖文件变更时需要重建对应服务：

- 后端：`pyproject.toml` 或 `uv.lock`
- 前端：`frontend/package.json` 或 `frontend/package-lock.json`

后端重建：

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build api
```

前端重建：

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build webui
```

### 5. 验证热重载行为

在测试机上建议执行以下检查：

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml ps
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml logs api --tail 50
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml logs webui --tail 50
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/readyz', timeout=5).status)"
```

然后确认：

- 编辑 `backend/` 下的文件会触发后端重载
- 编辑 `frontend/src/` 下的文件会触发前端重新编译或 HMR
- 纯源码的 `git pull` 无需重建即可生效

## SQLite 与 PostgreSQL

### SQLite

适合：

- 单机部署
- 低流量场景
- 试用或小团队内部使用

当前默认 compose 配置下，SQLite 文件位于 Docker named volume 中：

- base compose 里的 named volume

测试预发覆盖层下，SQLite 文件位于仓库内 bind mount：

- `./data/skillhub.db`

### PostgreSQL

更适合：

- 正式生产环境
- 更高写入量
- 更强的并发一致性需求

如果切换到 PostgreSQL，请更新 `DATABASE_URL`，并在 Compose 中额外加入 `db` 服务。

## Linux 检查清单

- 打开 Nginx 所在主机的 `80` 和 `443` 端口
- 确保 Docker 只把 Web UI 发布到 `127.0.0.1:3000`
- 如果不需要机器直连后端，就不要额外暴露 `8001`
- 设置一个真实且足够长的 `SECRET_KEY`
- 设置 `DEBUG=false`
- 只有在使用测试预发覆盖层时，才需要确保 `./data` 和 `./logs` 可写
- 如果 `1000:1000` 不是宿主机用户，请把 `LOCAL_UID` 和 `LOCAL_GID` 设成对应值
- 如果不是低流量单节点场景，优先使用 PostgreSQL
- 只要修改了 `NEXT_PUBLIC_API_BASE_URL`，就需要重新构建 Web UI

## 常见错误

- 把 `NEXT_PUBLIC_API_BASE_URL` 设成 `http://api:8001`
  这个地址只在 Docker 网络内部有效，浏览器里不能用。

- `NEXT_PUBLIC_API_BASE_URL` 还保留着旧服务器 IP
  前端会持续请求错误地址，直到重新构建。

- 同时让 `webui` 直接监听宿主机 `80`，又额外使用外部 Nginx 反向代理
  这样会造成端口冲突，也破坏当前的反向代理布局。

- 改了后端能力环境变量，但修改公网前端地址后没有重建前端
  业务能力开关不要求重建前端，但公网 API 地址变更一定需要。

- 在测试预发覆盖层里把 `/app/data` 和 `/app/logs` 绑定到宿主机目录后，没有给容器用户可写权限
  会导致 SQLite 迁移失败，或者日志文件无法创建，常见报错是 `unable to open database file`。

- `uv.lock` 用一个源生成，构建时又用另一个源
  这样很容易导致构建卡住，或者依赖仍然去错误的包源下载。

- 修改了 `shared/user-statuses.json`，却没有执行 `python scripts/sync_shared_catalogs.py --write`
  backend 和 frontend 构建读取的是各自已提交的本地副本，不同步就不会生效。

- 误以为 README 已经覆盖了全部生产部署细节
  Linux 部署以本文档为准。
