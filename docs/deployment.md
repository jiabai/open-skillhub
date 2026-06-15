# Deployment Guide

## Scope

This guide covers Linux deployment for the current repository layout. Docker Compose is the primary path, and this guide also records the standalone Next.js + systemd frontend path for hosts that do not run the web UI in Docker.

It assumes:

- backend runs on port `8001`
- for Docker deployments, web UI runs on port `3000` in Docker and is published to host `127.0.0.1:3000`
- for non-Docker frontend deployments, the Next.js standalone service is managed by systemd and listens on host `127.0.0.1:3000`
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

For preprod or any browser-facing deployment, set it to the public origin that browsers actually use, such as the current public domain `https://8xf.pro`.

Do not use `0.0.0.0`; that is only a bind/listen address. Do not point it at the internal Docker hostname like `http://api:8001`.

If you change this value, rebuild the frontend image for Docker deployments. For non-Docker standalone deployments, rerun `npm run build` and restart the Next.js systemd service.

### 4. Internal API URL is deployment-specific

For Docker deployments, keep:

```env
API_INTERNAL_URL=http://api:8001
```

This is only used by the Next.js server-side rewrite inside the frontend container.

For non-Docker standalone frontend deployments, this usually becomes:

```env
API_INTERNAL_URL=http://127.0.0.1:8001
```

`API_INTERNAL_URL` is written into the Next.js rewrite build output, so changing it also requires rebuilding the frontend.

### 5. Default stack uses a named volume; the dev overlay uses host bind mounts

The default compose file uses the Docker named volume from [docker-compose.yml](/D:/Github/skilldrive/docker-compose.yml), so it does not require host `./data` or `./logs` directories.

The test-preprod overlay in [docker-compose.dev.yml](/D:/Github/skilldrive/docker-compose.dev.yml) bind-mounts these repo-local host paths instead:

- `./data` -> `/app/data`
- `./logs` -> `/app/logs`
- `./backend` -> `/app/backend`
- `./frontend` -> `/workspace/frontend`

This means, for the overlay:

- SQLite lives at `./data/skilldrive.db`
- skill files live under `./data/skills`
- API logs live at `./logs/api.log`
- backend code reloads through `uvicorn --reload`
- frontend code reloads through `next dev`
- you can override the container user with `LOCAL_UID` and `LOCAL_GID` if the host user is not `1000:1000`

The repository includes a template at [.env.preprod.example](/D:/Github/skilldrive/.env.preprod.example) so you can copy it to a local `.env.preprod` file and run the overlay with `docker compose --env-file .env.preprod ...`.

### 5.1 Host-side public skill import for the test-preprod overlay

When the test-preprod overlay is active, host-side skill files live under `./data/skills`, so you can import a public skill without entering the container.

If you want the shortest operator checklist, see [Preprod Public Skill Import SOP](/D:/Github/skilldrive/docs/references/public-skill-import-preprod-sop.md).

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
uv run python backend/scripts/sync_public_skills.py --docker --docker-service skilldrive-api demo-skill
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

### 7. Shared catalogs are synced before build, not loaded from root `shared/` at runtime

Files under `shared/` are authoring sources, but backend and frontend each consume
committed local copies during runtime:

- `shared/user-statuses.json`
  - backend: `backend/domain/user-statuses.json`
  - frontend: `frontend/src/generated/user-statuses.json`
- `shared/skill-visibilities.json`
  - backend: `backend/domain/skill-visibilities.json`
  - frontend: `frontend/src/generated/skill-visibilities.json`

Before Docker builds, release packaging, or CI validation, run:

```bash
python scripts/sync_shared_catalogs.py --check
```

If you intentionally edited a shared catalog, regenerate the local copies first:

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

For the default stack or the dev overlay, set `NEXT_PUBLIC_API_BASE_URL` to the browser-facing origin. In the overlay, `.env.preprod` can default to `http://127.0.0.1:3000` for local-only access. For preprod or any public browser access, override it to the actual public origin, such as the current public domain `https://8xf.pro`.

Do not use `0.0.0.0`; it is only a bind/listen address. Do not point it at `http://api:8001`.

Keep `API_INTERNAL_URL=http://api:8001` for the Next.js server-side rewrite inside the frontend container.

In the overlay, the browser will call the public frontend origin, and Next.js forwards those requests to the backend container.

### 4. Configure Nginx reverse proxy

An example config is provided at [deploy/nginx/skilldrive.conf](/D:/Github/skilldrive/deploy/nginx/skilldrive.conf).

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

If the same frontend is reachable through both the bare domain and the `www` domain, include both HTTPS origins in `CORS_ORIGINS`, for example `https://8xf.pro` and `https://www.8xf.pro`. Otherwise, when the frontend build's `NEXT_PUBLIC_API_BASE_URL` points at one hostname and the browser opens the other, runtime-config and login requests are treated as cross-origin and can be blocked by the browser.

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

The overlay file [docker-compose.dev.yml](/D:/Github/skilldrive/docker-compose.dev.yml) keeps the default [docker-compose.yml](/D:/Github/skilldrive/docker-compose.yml) intact and switches the runtime behavior to:

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

Copy [.env.preprod.example](/D:/Github/skilldrive/.env.preprod.example) to `.env.preprod`, then override `NEXT_PUBLIC_API_BASE_URL` if your test machine uses a different public IP or domain.

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

If you edit a catalog under `shared/`, run `python scripts/sync_shared_catalogs.py --write` on the host first so the committed runtime-local copies under `backend/domain/` and `frontend/src/generated/` are refreshed before rebuilds or reload checks.

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

## Non-Docker Standalone Next.js Deployment

Use this flow when the backend and frontend run directly on the host, with host Nginx proxying public traffic to `127.0.0.1:3000`.

The repository provides a systemd template at [deploy/systemd/skilldrive-nextjs.service](/D:/Github/skilldrive/deploy/systemd/skilldrive-nextjs.service). The template assumes:

- working directory `frontend/.next/standalone`
- `node server.js` starts the Next.js standalone build output
- `HOSTNAME=127.0.0.1` and `PORT=3000`
- Nginx owns the public `80` / `443` entry point

### 1. Set frontend build env

Prepare a local `frontend/.env` from [frontend/.env.example](/D:/Github/skilldrive/frontend/.env.example). Production or public-host example:

```env
NEXT_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN
API_INTERNAL_URL=http://127.0.0.1:8001
```

Rules:

- `NEXT_PUBLIC_API_BASE_URL` must be the browser-facing frontend origin, such as `https://8xf.pro`
- `API_INTERNAL_URL` is the backend target for the Next.js server-side rewrite; on the same host it is usually `http://127.0.0.1:8001`
- both values are compiled into the frontend build output, so changing either value requires rebuilding the frontend

### 2. Build the standalone frontend output

From the repository root:

```bash
cd frontend
npm run build
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/
cp -R public .next/standalone/
```

If dependency files changed, run this first:

```bash
npm ci
```

A successful build writes `frontend/.next/standalone/server.js`. The Next.js standalone output does not automatically include `.next/static` or `public`, while the current systemd template runs from `frontend/.next/standalone`. Run the copy commands above; otherwise the HTML page may return successfully while `/_next/static/...` JS, CSS, or font assets return `404`, leaving the browser page blank.

### 3. Install or restart the systemd service

For the first install, adjust `deploy/systemd/skilldrive-nextjs.service` for the actual user, repository path, and Node path, then run:

```bash
sudo cp deploy/systemd/skilldrive-nextjs.service /etc/systemd/system/skilldrive-nextjs.service
sudo systemctl daemon-reload
sudo systemctl enable --now skilldrive-nextjs.service
```

If the service is already installed, only restart it after rebuilding:

```bash
sudo systemctl restart skilldrive-nextjs.service
```

### 4. Verify

From the server:

```bash
systemctl status skilldrive-nextjs.service --no-pager
curl -I http://127.0.0.1:3000
curl -sS https://YOUR_DOMAIN/api/v1/runtime-config
```

Expected results:

- `skilldrive-nextjs.service` is `active (running)`
- local `127.0.0.1:3000` returns `200 OK`
- `/api/v1/runtime-config` under the public domain returns capability JSON

### 5. When to rebuild

Rebuild, copy static assets, then run `systemctl restart skilldrive-nextjs.service` after changing:

- `NEXT_PUBLIC_API_BASE_URL`
- `API_INTERNAL_URL`
- production frontend source code
- `frontend/package.json` or `frontend/package-lock.json`

Only restart the affected service for:

- backend-only env changes: restart the backend service
- Nginx-only config changes: test and reload Nginx
- backend-only code changes: restart or hot-reload the backend according to the backend deployment path

## SQLite vs PostgreSQL

### SQLite

Good for:

- single-host deployment
- low traffic
- evaluation or internal small-team usage

Current default compose setup uses SQLite persisted in a Docker named volume:

- the named volume from `docker-compose.yml`

The test-preprod overlay uses the repo-local bind mount:

- `./data/skilldrive.db`

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
- rebuild web UI whenever `NEXT_PUBLIC_API_BASE_URL` changes; for non-Docker standalone deployments, also restart `skilldrive-nextjs.service`

## Common Mistakes

- Setting `NEXT_PUBLIC_API_BASE_URL` to `http://api:8001`
  This only works inside Docker, not in the browser.

- Leaving `NEXT_PUBLIC_API_BASE_URL` on an old server IP
  The web UI will keep calling the wrong host until rebuilt.

- Restarting `skilldrive-nextjs.service` in a non-Docker deployment without first running `npm run build`
  `NEXT_PUBLIC_API_BASE_URL` and `API_INTERNAL_URL` will still come from the old build output.

- Publishing `webui` directly on host port `80` while also using an external Nginx proxy
  This creates port conflicts and defeats the reverse-proxy layout.

- Editing backend feature envs but not rebuilding frontend after changing public origin
  Capability flags do not require frontend rebuild, but public API base does.

- Binding `/app/data` and `/app/logs` in the test-preprod overlay without matching write permissions
  SQLite migration and file logging will fail with `unable to open database file` or file permission errors.

- Regenerating `uv.lock` against one index and building against another
  Builds may stall or fetch from the wrong package source.

- Editing a catalog under `shared/` but skipping `python scripts/sync_shared_catalogs.py --write`
  Backend and frontend builds use their committed local copies, so the new source catalog will not take effect until the synced runtime files are regenerated.

- Assuming README already contains the full production guide
  Use this file for Linux deployment details.
