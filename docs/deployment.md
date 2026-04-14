# Deployment Guide

## Scope

This guide covers Linux deployment with Docker Compose for the current repository layout.

It assumes:

- backend runs on port `8001`
- frontend runs on port `3000` in Docker and is published to host `127.0.0.1:3000`
- an external Nginx reverse proxy terminates public traffic on port `80` or `443`
- frontend calls the backend through the public frontend origin plus `/api/*`
- Next.js rewrites proxy `/api/*` to `API_INTERNAL_URL`

## Important Deployment Notes

### 1. Backend image now uses a multi-stage build

`backend/Dockerfile` separates dependency resolution from the final runtime image:

- `builder` installs the locked Python environment with `uv`
- `runtime` contains only `/app/.venv`, backend source, and runtime directories

The `uv` cache is mounted at `/tmp/uv-cache` during build, so repeated builds can reuse downloaded packages when Docker BuildKit cache is preserved.

Operationally this means:

- the first `docker compose up -d --build migrate` can still take a few minutes on small hosts because it must build the backend image and download Python wheels
- later rebuilds should be much faster unless `pyproject.toml` or `uv.lock` changed, or the Docker build cache was cleared

### 2. Frontend public API base is a build-time setting

`NEXT_PUBLIC_API_BASE_URL` is compiled into the frontend build.

Recommended production value:

- `http://YOUR_SERVER_IP`
- or `https://YOUR_DOMAIN`

Do not point it at the internal Docker hostname like `http://api:8001`.
Do not leave it pointing at another machine's fixed public IP.

If you change this value, rebuild the frontend image.

### 3. Internal API URL stays inside the Docker network

Keep:

```env
API_INTERNAL_URL=http://api:8001
```

This is only used by the Next.js server-side rewrite inside the frontend container.

### 4. Backend runtime capabilities are served by the backend

Frontend business capability UI no longer comes from frontend env flags.
The frontend reads:

- `/api/v1/runtime-config`

So Linux deployment only needs correct backend env values. There is no separate frontend business feature-flag layer to keep in sync.

## Recommended Compose Deployment

The repository Compose file is now set up for a host-level Nginx reverse proxy:

- `migrate` runs Alembic once and exits successfully before the API starts
- `frontend` is published to host `127.0.0.1:3000`
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
- `LOG_FILE=` (keep empty for Docker unless you intentionally mount a file path)
- `CORS_ORIGINS`
- `DATABASE_URL` if using PostgreSQL

Example `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Set the frontend public origin

Before building, edit [docker-compose.yml](/D:/Github/open-skillhub/docker-compose.yml).

For a server IP deployment:

```yaml
args:
  - NEXT_PUBLIC_API_BASE_URL=http://YOUR_SERVER_IP
  - API_INTERNAL_URL=http://api:8001
```

For a domain deployment:

```yaml
args:
  - NEXT_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN
  - API_INTERNAL_URL=http://api:8001
```

This makes browser requests go to:

- `http://YOUR_SERVER_IP/api/v1/...`
- or `https://YOUR_DOMAIN/api/v1/...`

Then Next.js forwards those requests to the backend container.

### 3. Configure Nginx reverse proxy

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

### 4. Align backend CORS only if needed

If all browser traffic goes through the frontend origin and `/api` proxy, CORS is much less important.

Still, for safety, set `CORS_ORIGINS` in `backend/.env` to include your public frontend origin, for example:

```env
CORS_ORIGINS=["http://YOUR_SERVER_IP","https://YOUR_DOMAIN"]
```

Do not keep unrelated hardcoded public IPs in production config.

### 5. Run migrations and start services

```bash
docker compose up -d --build migrate
docker compose up -d api frontend
```

If your Compose installation does not support `depends_on.condition: service_completed_successfully`, use this fallback instead:

```bash
docker compose run --rm migrate
docker compose up -d --build api frontend
```

### 6. Verify

From the server:

```bash
docker compose config
docker compose ps
docker compose logs api --tail 50
docker compose exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/readyz', timeout=5).read().decode())"
```

From a browser:

- open `http://YOUR_SERVER_IP`
- or open `https://YOUR_DOMAIN`

Then verify:

- login page loads
- `/api/v1/runtime-config` returns through the frontend origin
- skill pages and audit pages render without frontend capability mismatch

## SQLite vs PostgreSQL

### SQLite

Good for:

- single-host deployment
- low traffic
- evaluation or internal small-team usage

Current default compose setup uses SQLite persisted in the Compose named volume:

- `skillhub-data`

### PostgreSQL

Recommended for:

- production workloads
- higher write volume
- stronger concurrency guarantees

If you switch to PostgreSQL, update `DATABASE_URL` and add a `db` service to Compose.

## Linux Checklist

- open ports `80` and `443` on the Nginx host
- ensure Docker publishes frontend only to `127.0.0.1:3000`
- only expose `8001` if you intentionally want the backend reachable directly
- set a real `SECRET_KEY`
- set `DEBUG=false`
- keep `LOG_FILE=` for Docker unless you intentionally mount a file path
- keep the default named volume `skillhub-data`, or replace it with an explicit storage mapping if you need host-path access
- use PostgreSQL if this is not a low-traffic single-node deployment
- rebuild frontend whenever `NEXT_PUBLIC_API_BASE_URL` changes

## Common Mistakes

- Setting `NEXT_PUBLIC_API_BASE_URL` to `http://api:8001`
  This only works inside Docker, not in the browser.

- Leaving `NEXT_PUBLIC_API_BASE_URL` on an old server IP
  The frontend will keep calling the wrong host until rebuilt.

- Publishing `frontend` directly on host port `80` while also using an external Nginx proxy
  This creates port conflicts and defeats the reverse-proxy layout.

- Editing backend feature envs but not rebuilding frontend after changing public origin
  Capability flags do not require frontend rebuild, but public API base does.

- Assuming README already contains the full production guide
  Use this file for Linux deployment details.
