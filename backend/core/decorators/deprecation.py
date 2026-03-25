from functools import wraps
from inspect import signature
from typing import Callable, Optional

from fastapi import Response


def deprecated(
    sunset_date: Optional[str] = None,
    alternative: Optional[str] = None,
) -> Callable:
    """
    标记端点为已弃用的装饰器

    注意：推荐配合 FastAPI 的 Response 依赖注入使用。
    当路由函数未声明 `response: Response` 时，装饰器会尝试在运行时参数中查找 Response 对象并写入响应头。

    Args:
        sunset_date: 端点完全移除的日期（ISO 8601格式，如 "2026-12-31"）
        alternative: 替代端点的路径

    Usage:
        @router.get("/legacy/endpoint")
        @deprecated(sunset_date="2026-12-31", alternative="/api/v1/new/endpoint")
        async def legacy_endpoint(response: Response):
            '''已弃用的端点'''
            return {"message": "This endpoint is deprecated"}
    """

    def decorator(func: Callable) -> Callable:
        accepts_response = "response" in signature(func).parameters

        @wraps(func)
        async def wrapper(*args, response: Optional[Response] = None, **kwargs):
            target_response = response
            if target_response is None:
                value = kwargs.get("response")
                if isinstance(value, Response):
                    target_response = value
            if target_response is None:
                for item in args:
                    if isinstance(item, Response):
                        target_response = item
                        break
            if target_response is not None:
                target_response.headers["Deprecation"] = "true"
                if sunset_date:
                    target_response.headers["Sunset"] = sunset_date
                if alternative:
                    target_response.headers["Link"] = f'<{alternative}>; rel="successor-version"'
            if accepts_response:
                if "response" not in kwargs and response is not None:
                    kwargs["response"] = response
            return await func(*args, **kwargs)

        setattr(wrapper, "_deprecated", True)
        setattr(wrapper, "_sunset_date", sunset_date)
        setattr(wrapper, "_alternative", alternative)

        return wrapper

    return decorator


def get_deprecation_metadata(func: Callable) -> dict:
    """
    获取函数的弃用元数据，用于文档生成

    Returns:
        dict: 包含 deprecated, sunset_date, alternative 的字典
    """
    return {
        "deprecated": getattr(func, "_deprecated", False),
        "sunset_date": getattr(func, "_sunset_date", None),
        "alternative": getattr(func, "_alternative", None),
    }
