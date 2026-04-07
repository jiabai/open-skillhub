Bug #6: 缺少下载速率限制（滥用风险）

位置:
- 全局缺失（download 接口无任何限流机制）
- 对比: 其他接口可能有中间件级别的限流（需确认）

问题描述:

与上传接口不同，下载接口没有任何速率限制机制。在 RBAC 关闭的情况下，任何认证用户都可以高频调用下载接口，可能被滥用于批量爬取或资源消耗攻击。

潜在风险:
- 批量爬取所有 Skills（如果可见性控制也关闭）
- 消耗大量服务器带宽和 I/O
- 影响 other users 正常使用体验

复现步骤:

1. 创建脚本循环调用 /api/v1/skills/download 接口
2. 每秒调用 100 次，持续 10 分钟
3. 观察服务器资源占用和网络带宽
4. 预期: 应触发速率限制，返回 429 Too Many Requests
5. 实际: 所有请求正常执行，服务器资源持续消耗

修复建议:

方案 A: 使用 slowapi 添加限流（推荐）
```bash
pip install slowapi
```

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter

@router.post("/download")
@limiter.limit("10/minute")  # 全局：每分钟最多 10 次
async def download_skill(request, ...):
    ...
```

方案 B: 基于 user_id 的限流（更精细）
```python
@router.post("/download")
@limiter.limit("30/minute", key=lambda r: r.user.id if hasattr(r, 'user') else get_remote_address(r))  # 每用户每分钟 30 次
async def download_skill(request, ...):
    ...
```

方案 C: Redis 分布式限流（适合多实例部署）
```python
import redis
import time

async def check_rate_limit(user_id: str, limit: int = 30, window_seconds: int = 60) -> bool:
    r = redis.Redis()
    key = f"download_rate:{user_id}"
    current = r.incr(key)
    if current == 1:
        r.expire(key, window_seconds)
    return current <= limit

@router.post("/download")
async def download_skill(request, current_user, ...):
    if not await check_rate_limit(current_user.id):
        raise HTTPException(429, "Too many requests. Please try again later.")
    ...
```
