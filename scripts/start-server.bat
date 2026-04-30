@echo off
REM Open SkillHub 启动脚本 (Batch)
REM 用法: scripts\start-server.bat [port] [--skip-config-check]

setlocal enabledelayedexpansion

set PROJECT_ROOT=%~dp0..
set HOST=0.0.0.0
set PORT=%1
if "%PORT%"=="" set PORT=8001
set SKIP_CONFIG_CHECK=0
if "%2"=="--skip-config-check" set SKIP_CONFIG_CHECK=1

echo ========================================
echo   Open SkillHub Server Launcher
echo ========================================
echo.

cd /d "%PROJECT_ROOT%"
echo [1/5] Project root: %PROJECT_ROOT%

where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: uv not found. Install it first: https://docs.astral.sh/uv/getting-started/installation/
    exit /b 1
)

for /f "tokens=*" %%i in ('uv --version') do set UV_VERSION=%%i
echo [2/5] uv found: %UV_VERSION%

if exist "%PROJECT_ROOT%\backend\.env" (
    echo [3/5] Using config file: %PROJECT_ROOT%\backend\.env
) else (
    echo WARNING: .env file not found at %PROJECT_ROOT%\backend\.env
    echo          Using default settings from .env.example
)

REM 验证环境配置
set HAS_ERROR=0

if "%SKIP_CONFIG_CHECK%"=="1" (
    echo [4/5] Skipping configuration validation (--skip-config-check^)
    goto :skip_config_check
)

if not exist "%PROJECT_ROOT%\backend\.env" (
    echo [4/5] Skipping configuration validation (no .env file^)
    goto :skip_config_check
)

echo [4/5] Validating environment configuration...

set DATABASE_URL_VAL=
set SECRET_KEY_VAL=
set DEBUG_VAL=
set CORS_ORIGINS_VAL=

for /f "usebackq tokens=1,* delims==" %%a in ("%PROJECT_ROOT%\backend\.env"^^) do (
    set "KEY=%%a"
    set "VAL=%%b"
    if "!KEY!"=="DATABASE_URL" set DATABASE_URL_VAL=%%b
    if "!KEY!"=="SECRET_KEY" set SECRET_KEY_VAL=%%b
    if "!KEY!"=="DEBUG" set DEBUG_VAL=%%b
    if "!KEY!"=="CORS_ORIGINS" set CORS_ORIGINS_VAL=%%b
)

if not defined DATABASE_URL_VAL (
    echo       ERROR: DATABASE_URL is not set
    set HAS_ERROR=1
) else (
    echo       DATABASE_URL: OK
)

if not defined SECRET_KEY_VAL (
    echo       ERROR: SECRET_KEY is not set
    set HAS_ERROR=1
) else (
    set "SK_LEN=0"
    for /l %%i in (0,1,100) do (
        if "!SECRET_KEY_VAL:~%%i,1!" neq "" set /a SK_LEN=%%i+1
    )
    if !SK_LEN! LSS 32 (
        echo       ERROR: SECRET_KEY must be at least 32 characters (current: !SK_LEN!^)
        set HAS_ERROR=1
    ) else (
        echo       SECRET_KEY: OK (!SK_LEN! chars^)
    )
)

if not "!DEBUG_VAL!"=="true" (
    if not defined CORS_ORIGINS_VAL (
        echo       ERROR: CORS_ORIGINS must be explicitly configured in production mode
        set HAS_ERROR=1
    ) else (
        if "!CORS_ORIGINS_VAL!"=="[""*""]" (
            echo       ERROR: CORS_ORIGINS cannot be [*] in production mode
            set HAS_ERROR=1
        ) else (
            echo       CORS_ORIGINS: OK
        )
    )
) else (
    echo       CORS_ORIGINS: SKIPPED (DEBUG mode^)
)

if "!HAS_ERROR!"=="1" (
    echo.
    echo ERROR: Environment configuration validation failed. Fix the errors above before starting the server.
    exit /b 1
)

echo       Configuration validated.

:skip_config_check

REM 运行数据库迁移
echo [5/5] Running database migrations...
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

uv run python -m uvicorn backend.api_app:app --host %HOST% --port %PORT%
