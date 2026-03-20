# Open SkillHub 后端设计与开发文档 — 部署与运维

> 本文档描述 Docker 部署、环境配置、日志规范及运维工具。

---

## 1. Docker 部署

### 1.1 镜像构建

```dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml LICENSE README.md README_ZH.md alembic.ini /app/
COPY skillhub /app/skillhub

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000"]
```

### 1.2 Docker Compose 服务

| 服务 | 说明 |
|------|------|
| `db` | PostgreSQL 14 数据库 |
| `migrate` | 数据库迁移（启动时运行一次） |
| `api` | FastAPI 应用（uvicorn，端口 8000） |

### 1.3 持久化卷

| 卷 | 用途 |
|----|------|
| `pgdata` | PostgreSQL 数据目录 |
| `skills` | Skill 文件存储（`/data/skills`） |

### 1.4 启动顺序

```
db (健康检查等待)
    ↓
migrate (alembic upgrade head)
    ↓
api (uvicorn 启动)
```

---

## 2. 环境配置

### 2.1 必需配置

| 配置项 | 说明 |
|--------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串（`postgresql+asyncpg://...`） |
| `SECRET_KEY` | JWT 签名密钥（至少 32 字符） |

### 2.2 数据库配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_POOL_SIZE` | 20 | 连接池大小 |
| `DATABASE_MAX_OVERFLOW` | 10 | 最大溢出连接数 |
| `DATABASE_POOL_TIMEOUT` | 30 | 连接获取超时（秒） |
| `DATABASE_POOL_RECYCLE` | 1800 | 连接回收时间（秒） |

### 2.3 日志配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LOG_LEVEL` | INFO | 日志级别 |
| `LOG_FORMAT` | json | 日志格式（json / text） |
| `LOG_FILE` | /var/log/skillhub/app.log | 日志文件路径（空字符串表示仅输出到 stdout） |

### 2.4 存储配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SKILL_STORAGE_PATH` | /data/skills | Skill 文件存储根目录 |
| `SKILL_ARCHIVE_BACKEND` | local | 归档存储后端（local / s3） |
| `SKILL_ARCHIVE_S3_BUCKET` | — | S3 Bucket（可选） |
| `SKILL_ARCHIVE_S3_REGION` | — | S3 Region（可选） |
| `SKILL_ARCHIVE_S3_ENDPOINT` | — | S3 Endpoint（可选，兼容 MinIO） |
| `SKILL_ARCHIVE_S3_ACCESS_KEY_ID` | — | S3 AccessKey ID |
| `SKILL_ARCHIVE_S3_SECRET_ACCESS_KEY` | — | S3 AccessKey Secret |
| `SKILL_ARCHIVE_S3_FORCE_PATH_STYLE` | true | S3 路径风格（MinIO 需要启用） |

### 2.5 指标配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `METRICS_RETENTION_DAYS` | 90 | 指标数据保留天数 |
| `ENABLE_METRICS` | true | 是否启用指标收集 |

---

## 3. 日志规范

### 3.1 日志格式

**JSON 格式（生产环境）**：
```json
{
  "level": "INFO",
  "time": "2026-03-20T10:00:00Z",
  "message": "Request completed",
  "method": "POST",
  "path": "/api/v1/skills",
  "status": 201,
  "duration_ms": 45
}
```

**文本格式（开发环境）**：
```
2026-03-20 10:00:00 | INFO | Request completed | method=POST path=/api/v1/skills status=201 duration_ms=45
```

### 3.2 日志内容要求

- 所有请求通过 `RequestLoggingMiddleware` 记录
- 包含：时间戳、级别、方法、路径、状态码、耗时、客户端 IP
- 敏感信息（Token、密码）不应写入日志

### 3.3 日志输出

| 环境 | 输出目标 |
|------|---------|
| Docker / 生产 | stdout（由容器运行时收集） |
| 本地开发 | stdout + 文件（`LOG_FILE` 配置） |

---

## 4. 运维工具

### 4.1 数据库迁移

```bash
# 升级到最新版本
alembic upgrade head

# 查看当前版本
alembic current

# 查看迁移历史
alembic history

# 生成新迁移
alembic revision --autogenerate -m "description"
```

### 4.2 健康检查

```bash
GET /health
```

响应：
```json
{
  "status": "healthy",
  "db_connected": true
}
```

- `status=healthy`：所有检查通过
- `status=unhealthy`：数据库连接失败
- HTTP 状态码：200（健康）/ 503（不健康）

### 4.3 指标端点

```bash
GET /metrics
```

前提：`ENABLE_METRICS=true`

返回 Prometheus 格式的指标数据，包含：
- 请求计数
- 成功率
- 延迟分布

### 4.4 指标清理

```bash
POST /api/v1/dashboard/metrics/cleanup
{
  "retention_days": 90  // 可选，默认使用 METRICS_RETENTION_DAYS 配置
}
```

仅超级用户可调用。清理 `request_metrics` 表中早于 `retention_days` 的记录。

### 4.5 24 小时指标重置

```bash
POST /api/v1/dashboard/metrics/reset-24h
```

重置当前用户的 24 小时成功率的滑动窗口数据。

---

## 5. 非功能性需求（NFR）

### 5.1 性能目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| API 响应时间 | < 200ms (p95) | 不含 Skill 执行时间 |
| Skill 执行超时 | 300s（可配置） | `SKILL_EXECUTION_TIMEOUT_SECONDS` |
| 数据库查询 | < 50ms | 单次查询 |

### 5.2 限流机制

**实现方式**：基于内存的滑动窗口算法

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `ENABLE_RATE_LIMIT` | true | 是否启用限流 |
| `RATE_LIMIT_REQUESTS` | 100 | 时间窗口内最大请求数 |
| `RATE_LIMIT_WINDOW` | 60 | 时间窗口（秒） |

**算法特点**：
- 按 IP 地址隔离
- 滑动窗口精确计算
- 内存存储（单机适用）
- 超限返回 429 + `RATE_LIMIT_EXCEEDED` 错误码

**注意**：分布式部署场景需替换为 Redis 或其他分布式存储。

### 5.3 可用性目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 可用性 | 99.9% | 年停机时间 < 8.76 小时 |
| RPO | 1 小时 | 数据备份频率 |
| RTO | 4 小时 | 恢复时间目标 |

### 5.4 请求指标聚合

系统按小时桶聚合请求指标（`RequestMetric` 表），支持：
- 24 小时成功率计算
- 用户级请求统计
- 指标数据保留（默认 90 天）

---

## 6. 数据库运维

### 6.1 连接池配置建议

| 场景 | POOL_SIZE | MAX_OVERFLOW | POOL_TIMEOUT |
|------|-----------|--------------|--------------|
| 小型（< 100 并发） | 10 | 5 | 30 |
| 中型（100-500 并发） | 20 | 10 | 30 |
| 大型（> 500 并发） | 50 | 20 | 30 |

### 6.2 慢查询监控

建议在 PostgreSQL 侧开启 `pg_stat_statements` 扩展，监控慢查询：

```sql
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

---

## 7. Docker 环境变量示例

```bash
# 数据库
DATABASE_URL=postgresql+asyncpg://skillhub:skillhub@db:5432/skillhub

# 安全
SECRET_KEY=your-secret-key-at-least-32-characters-long

# CORS
CORS_ORIGINS=["https://your-domain.com"]

# 日志
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=

# 功能开关
ENABLE_PUBLIC_SIGNUP=false
ENABLE_SSO=true
ENABLE_ORG_MODEL=true
ENABLE_RBAC=true
ENABLE_SKILL_VISIBILITY=true
ENABLE_AUDIT_LOG=true
ENABLE_AUDIT_EXPORT=true
```
