@echo off
REM Open SkillHub 启动脚本 (Batch)
REM 用法: scripts\start-server.bat [port]

setlocal enabledelayedexpansion

set PROJECT_ROOT=%~dp0..
set HOST=0.0.0.0
set PORT=%1
if "%PORT%"=="" set PORT=8001

echo ========================================
echo   Open SkillHub Server Launcher
echo ========================================
echo.

cd /d "%PROJECT_ROOT%"
echo [1/3] Project root: %PROJECT_ROOT%

REM 检查 uv 是否可用
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: uv not found. Install it first: https://docs.astral.sh/uv/getting-started/installation/
    exit /b 1
)

for /f "tokens=*" %%i in ('uv --version') do set UV_VERSION=%%i
echo [2/3] uv found: %UV_VERSION%

REM 检查 .env 配置文件
if exist "%PROJECT_ROOT%\backend\.env" (
    echo [3/4] Using config file: %PROJECT_ROOT%\backend\.env
) else (
    echo WARNING: .env file not found at %PROJECT_ROOT%\backend\.env
    echo          Using default settings from .env.example
)

REM 运行数据库迁移
echo [4/4] Running database migrations...
uv run python -m alembic -c backend/alembic.ini upgrade head
if %errorlevel% neq 0 (
    echo ERROR: Database migration failed!
    exit /b 1
)
echo       Migration completed.

echo.
echo Starting API server on http://%HOST%:%PORT% ...
echo Press Ctrl+C to stop.
echo.

REM 启动 uvicorn 服务
uv run python -m uvicorn backend.api_app:app --host %HOST% --port %PORT%
