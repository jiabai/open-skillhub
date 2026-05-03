# Deployment Guide

## Scope

This guide covers Linux deployment with Docker Compose for the current repository layout, including both the default deployment-style stack and a test-machine hot-reload overlay.

It assumes:

- backend runs on port `8001`
- web UI runs on port `3000` in Docker and is published to host `127.0.0.1:3000`
- an external Nginx reverse proxy terminates public traffic on port `80` or `443`
- web UI calls the backend through the public frontend origin plus `/api/*`
- Next.js rewrites proxy `/api/*` to `API_INTERNAL_URL`

## Important Deployment Notes

### 1. Backend image now uses a multi-stage build

`backend/Dockerfile` separates dependency resolution from the final runtime image:

- `builder` installs the locked Python environment with `uv`
- `runtime` contains only `/app/.venv`, backend source, and runtime directories

The `uv` cache is mounted at `/tmp/uv-cache` during build, so repeated builds can reuse downloaded packages when Docker BuildKit cache is preserved.

Operationally this means:

- the first `docker compose up -d --build migrate api webui` can still take a few minutes on small hosts because it must build the backend image and download Python wheels
- later rebuilds should be much faster unless `pyproject.toml` or `uv.lock` changed, or the Docker build cache was cleared

### 2. `uv.lock` and package index must stay aligned

The compose file passes:

```env
UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
```

If `uv.lock` still points at `pypi.org` / `files.pythonhosted.org`, `docker compose build migrate` may still stall on slow or proxied networks even though `UV_DEFAULT_INDEX` is set.

Before rebuilding in mainland China or other restricted environments, regenerate the lock file against the mirror if needed:

```bash
UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple uv lock
```

You can verify the lock file no longer references the upstream PyPI hosts:

```bash
grep -n "pypi.org/simple\\|files.pythonhosted.org" uv.lock | head
```

### 3. Web UI public API base is a build-time setting

`NEXT_PUBLIC_API_BASE_URL` is compiled into the frontend build.

For local-only development, the test-preprod overlay can keep `http://127.0.0.1:3000`.

For preprod or any browser-facing deployment, set it to the public origin that browsers actually use. For this host, that means `http://39.107.59.41`.

Do not use `0.0.0.0`; that is only a bind/listen address. Do not point it at the internal Docker hostname like `http://api:8001`.

If you change this value, rebuild the frontend image.

### 4. Internal API URL stays inside the Docker network

Keep:

```env
API_INTERNAL_URL=http://api:8001
```

This is only used by the Next.js server-side rewrite inside the frontend container.

### 5. Default stack uses a named volume; the dev overlay uses host bind mounts

The default compose file uses the Docker named volume from [docker-compose.yml](/D:/Github/open-skillhub/docker-compose.yml), so it does not require host `./data` or `./logs` directories.

The test-preprod overlay in [docker-compose.dev.yml](/D:/Github/open-skillhub/docker-compose.dev.yml) bind-mounts these repo-local host paths instead:

- `./data` -> `/app/data`
- `./logs` -> `/app/logs`
- `./backend` -> `/app/backend`
- `./frontend` -> `/workspace/frontend`

This means, for the overlay:

- SQLite lives at `./data/skillhub.db`
- skill files live under `./data/skills`
- API logs live at `./logs/api.log`
- backend code reloads through `uvicorn --reload`
- frontend code reloads through `next dev`
- you can override the container user with `LOCAL_UID` and `LOCAL_GID` if the host user is not `1000:1000`

The repository includes a template at [.env.preprod.example](/D:/Github/open-skillhub/.env.preprod.example) so you can copy it to a local `.env.preprod` file and run the overlay with `docker compose --env-file .env.preprod ...`.

### 5.1 Host-side public skill import for the test-preprod overlay

When the test-preprod overlay is active, host-side skill files live under `./data/skills`, so you can import a public skill without entering the container.

If you want the shortest operator checklist, see [Preprod Public Skill Import SOP](/D:/Github/open-skillhub/docs/references/public-skill-import-preprod-sop.md).

Prepare the skill directory on the host:

```bash
mkdir -p ./data/skills/__system__/demo-skill
```

Then run either a targeted import or a full reconciliation from the repository root:

```bash
uv run python backend/scripts/sync_public_skills.py demo-skill --storage-root ./data/skills
uv run python backend/scripts/sync_public_skills.py --storage-root ./data/skills
```

Behavior:

- passing `demo-skill` imports only that public skill and does not deactivate other public skills
- omitting the skill name runs the historical full sync and will deactivate public skills missing from disk
- `--storage-root` only changes where the import reads files from; the stored backend `skill_dir` still follows backend settings so container-side runtime paths remain stable

Recommended success checks after a targeted import:

1. The command exits with code `0`.
2. The imported skill is stored as `visibility=public` and `is_active=true`.
3. `GET /api/v1/skills/public` returns the imported skill.
4. `GET /api/v1/runtime-config` reports `public_skills=true`, and the public Skills page shows the same skill.

### 5.2 Public skill import for production Docker deployments

When using the default `docker-compose.yml` in production, data lives in a Docker named volume that is not directly accessible from the host. There are two ways to import public skills:

**Option 1: Use the `--docker` flag (recommended)**

The script supports a `--docker` flag that automatically executes the sync inside the API container via `docker compose exec`:

```bash
uv run python backend/scripts/sync_public_skills.py --docker demo-skill
uv run python backend/scripts/sync_public_skills.py --docker
```

If the API service name is not the default `api`, specify it with `--docker-service`:

```bash
uv run python backend/scripts/sync_public_skills.py --docker --docker-service open-skillhub-api demo-skill
```

**Option 2: Manually exec into the container**

```bash
docker compose exec api python backend/scripts/sync_public_skills.py demo-skill
docker compose exec api python backend/scripts/sync_public_skills.py
```

Regardless of which option you choose, you must first place the skill files inside the container at `/app/data/skills/__system__/`. You can copy a local skill directory into the container with `docker compose cp`:

```bash
docker compose cp ./local-skill/. api:/app/data/skills/__system__/demo-skill/
```

### 6. Backend runtime capabilities are served by the backend

Frontend business capability UI no longer comes from frontend env flags.
The frontend reads:

- `/api/v1/runtime-config`

So Linux deployment only needs correct backend env values. There is no separate frontend business feature-flag layer to keep in sync.

### 7. Shared user-status catalogs are synced before build, not loaded from root `shared/` at runtime

`shared/user-statuses.json` is the authoring source, but backend and frontend each
consume a committed local copy during runtime:

- backend: `backend/domain/user-statuses.json`
- frontend: `frontend/src/generated/user-statuses.json`

Before Docker builds, release packaging, or CI validation, run:

```bash
python scripts/sync_shared_catalogs.py --check
```

If you intentionally edited `shared/user-statuses.json`, regenerate the local
copies first:

```bash
python scripts/sync_shared_catalogs.py --write
```

## Recommended Compose Deployment

The repository Compose file is now set up for a host-level Nginx reverse proxy:

- `migrate` runs Alembic once and exits successfully before the API starts
- `webui` is published to host `127.0.0.1:3000`
- `api` is exposed only inside the Docker network on `8001`
- host Nginx should proxy public requests to `127.0.0.1:3000`

If you want to expose the backend directly for machine-to-machine access, add a host port mapping back to the `api` service explicitly.

### 1. Prepare backend env

```bash
cp backend/.env.example backend/.env
```

At minimum, update:

- `SECRET_KEY`
- `DEBUG=false`
- `LOG_LEVEL=INFO`
- `CORS_ORIGINS`
- `DATABASE_URL` if using PostgreSQL

Example `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Prepare repo-local directories for bind mounts

Only create these directories when you are using the test-preprod overlay:

```bash
mkdir -p ./data ./logs
```

Run this from the repository root. Then prepare a local env file for the overlay:

```bash
cp .env.preprod.example .env.preprod
```

If your deployment user is not UID/GID `1000:1000`, update `LOCAL_UID` and `LOCAL_GID` in `.env.preprod` to match the host user before starting the overlay.

### 3. Set the web UI public origin

Before building images, verify synced catalogs:

```bash
python scripts/sync_shared_catalogs.py --check
```

For the default stack or the dev overlay, set `NEXT_PUBLIC_API_BASE_URL` to the browser-facing origin. In the overlay, `.env.preprod` can default to `http://127.0.0.1:3000` for local-only access. For preprod or any public browser access, override it to the actual public origin, such as `http://39.107.59.41` on this host or a domain name.

Do not use `0.0.0.0`; it is only a bind/listen address. Do not point it at `http://api:8001`.

Keep `API_INTERNAL_URL=http://api:8001` for the Next.js server-side rewrite inside the frontend container.

In the overlay, the browser will call the public frontend origin, and Next.js forwards those requests to the backend container.

### 4. Configure Nginx reverse proxy

An example config is provided at [deploy/nginx/skillhub.conf](/D:/Github/open-skillhub/deploy/nginx/skillhub.conf).

Core routing:

- public `/` -> `127.0.0.1:3000`
- browser `/api/*` -> frontend origin
- frontend server-side rewrite `/api/*` -> `http://api:8001`

Example:

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

### 5. Align backend CORS only if needed

If all browser traffic goes through the frontend origin and `/api` proxy, CORS is much less important.

Still, for safety, set `CORS_ORIGINS` in `backend/.env` to include your public frontend origin, for example:

```env
CORS_ORIGINS=["http://YOUR_SERVER_IP","https://YOUR_DOMAIN"]
```

Do not keep unrelated hardcoded public IPs in production config.

### 6. Run migrations and start services

Recommended first boot sequence for the default stack:

```bash
docker compose up -d --build migrate api webui
```

This stack keeps runtime logs in Docker and uses the named SQLite volume from the base compose file.

If you want the test-preprod hot-reload overlay instead, use:

```bash
mkdir -p ./data ./logs
cp .env.preprod.example .env.preprod
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build migrate api webui
```

If your Compose installation does not support `depends_on.condition: service_completed_successfully`, use this fallback instead:

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml run --rm migrate
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d api webui
```

`docker compose up api` will also wait for `migrate` because `api` depends on `migrate` completing successfully. That is expected and does not reapply completed revisions.

### 7. Verify

From the server, for the default stack:

```bash
docker compose config
docker compose ps
docker compose logs api --tail 50
docker compose logs webui --tail 50
docker compose exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/readyz', timeout=5).read().decode())"
```

For the test-preprod overlay, use the same checks with `-f docker-compose.yml -f docker-compose.dev.yml`, then verify the host paths:

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

From a browser:

- open `http://YOUR_SERVER_IP`
- or open `https://YOUR_DOMAIN`

Then verify:

- login page loads
- `/api/v1/runtime-config` returns through the frontend origin
- skill pages and audit pages render without frontend capability mismatch

## Test-Machine Hot Reload

Use this mode only on a Linux test machine where source changes should reload without rebuilding containers.

The overlay file [docker-compose.dev.yml](/D:/Github/open-skillhub/docker-compose.dev.yml) keeps the default [docker-compose.yml](/D:/Github/open-skillhub/docker-compose.yml) intact and switches the runtime behavior to:

- backend source bind mount plus `uvicorn --reload`
- frontend source bind mount plus `next dev`
- the same reverse-proxy entry path as the default deployment
- manual dependency rebuilds and manual DB migrations

### 1. Configure the public frontend origin for dev mode

The dev overlay should default to a browser-facing origin such as `http://127.0.0.1:3000`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
API_INTERNAL_URL=http://api:8001
```

Copy [.env.preprod.example](/D:/Github/open-skillhub/.env.preprod.example) to `.env.preprod`, then override `NEXT_PUBLIC_API_BASE_URL` if your test machine uses a different public IP or domain.

### 2. Start or refresh the hot-reload stack

```bash
mkdir -p ./data ./logs
cp .env.preprod.example .env.preprod
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build migrate api webui
```

This uses repo-local bind mounts for `data/`, `logs/`, `backend/`, and `frontend/`, so the whole dev stack can move with the checked-out repository path. If the host user is not UID/GID `1000:1000`, update `LOCAL_UID` and `LOCAL_GID` in `.env.preprod` accordingly.

### 3. Run migrations manually when schema changes

Hot reload does not apply Alembic migrations automatically. When you pull a migration change or update backend models that require one, run:

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml run --rm migrate
```

The dev overlay bind-mounts `backend/` into the migration container, so newly pulled Alembic files are visible without rebuilding the backend image.

### 4. Know when rebuilds are still required

Source-only changes should reload automatically after `git pull`.

If you edit `shared/user-statuses.json`, run `python scripts/sync_shared_catalogs.py --write` on the host first so the committed runtime-local copies under `backend/domain/` and `frontend/src/generated/` are refreshed before rebuilds or reload checks.

Rebuild the affected service when dependency files change:

- backend: `pyproject.toml` or `uv.lock`
- frontend: `frontend/package.json` or `frontend/package-lock.json`

Backend rebuild:

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build api
```

Frontend rebuild:

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml up -d --build webui
```

### 5. Verify hot reload behavior

Recommended checks on the test machine:

```bash
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml ps
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml logs api --tail 50
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml logs webui --tail 50
docker compose --env-file .env.preprod -f docker-compose.yml -f docker-compose.dev.yml exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/readyz', timeout=5).status)"
```

Then confirm:

- editing a file under `backend/` triggers backend reload
- editing a file under `frontend/src/` triggers frontend recompilation or HMR
- a source-only `git pull` is reflected without rebuilding

## SQLite vs PostgreSQL

### SQLite

Good for:

- single-host deployment
- low traffic
- evaluation or internal small-team usage

Current default compose setup uses SQLite persisted in a Docker named volume:

- the named volume from `docker-compose.yml`

The test-preprod overlay uses the repo-local bind mount:

- `./data/skillhub.db`

### PostgreSQL

Recommended for:

- production workloads
- higher write volume
- stronger concurrency guarantees

If you switch to PostgreSQL, update `DATABASE_URL` and add a `db` service to Compose.

## Linux Checklist

- open ports `80` and `443` on the Nginx host
- ensure Docker publishes web UI only to `127.0.0.1:3000`
- only expose `8001` if you intentionally want the backend reachable directly
- set a real `SECRET_KEY`
- set `DEBUG=false`
- ensure `./data` and `./logs` exist and are writable when using the test-preprod overlay
- set `LOCAL_UID` and `LOCAL_GID` to match the host user if `1000:1000` is not writable
- use PostgreSQL if this is not a low-traffic single-node deployment
- rebuild web UI whenever `NEXT_PUBLIC_API_BASE_URL` changes

## Common Mistakes

- Setting `NEXT_PUBLIC_API_BASE_URL` to `http://api:8001`
  This only works inside Docker, not in the browser.

- Leaving `NEXT_PUBLIC_API_BASE_URL` on an old server IP
  The web UI will keep calling the wrong host until rebuilt.

- Publishing `webui` directly on host port `80` while also using an external Nginx proxy
  This creates port conflicts and defeats the reverse-proxy layout.

- Editing backend feature envs but not rebuilding frontend after changing public origin
  Capability flags do not require frontend rebuild, but public API base does.

- Binding `/app/data` and `/app/logs` in the test-preprod overlay without matching write permissions
  SQLite migration and file logging will fail with `unable to open database file` or file permission errors.

- Regenerating `uv.lock` against one index and building against another
  Builds may stall or fetch from the wrong package source.

- Editing `shared/user-statuses.json` but skipping `python scripts/sync_shared_catalogs.py --write`
  Backend and frontend builds use their committed local copies, so the new source catalog will not take effect until the synced runtime files are regenerated.

- Assuming README already contains the full production guide
  Use this file for Linux deployment details.
