@echo off
REM SkillDrive 前端启动脚本 (Batch)
REM 用法: scripts\start-frontend.bat [port] [api_url]

setlocal enabledelayedexpansion

set PROJECT_ROOT=%~dp0..
set FRONTEND_DIR=%PROJECT_ROOT%\frontend
set PORT=%1
if "%PORT%"=="" set PORT=3000
set API_URL=%2
if "%API_URL%"=="" set API_URL=http://localhost:8001

echo ========================================
echo   SkillDrive Frontend Launcher
echo ========================================
echo.

cd /d "%FRONTEND_DIR%"
echo [1/3] Frontend directory: %FRONTEND_DIR%

REM 检查 Node.js 是否可用
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install it first: https://nodejs.org/
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [2/3] Node.js found: %NODE_VERSION%

REM 检查依赖是否已安装
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed!
        exit /b 1
    )
    echo Dependencies installed.
) else (
    echo [3/3] Dependencies already installed.
)

echo.
echo Starting Next.js dev server on http://localhost:%PORT% ...
echo API Base URL: %API_URL%
echo Press Ctrl+C to stop.
echo.

REM 设置环境变量并启动
set NEXT_PUBLIC_API_BASE_URL=%API_URL%
npm run dev -- --port %PORT%
