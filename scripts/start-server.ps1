# Open SkillHub 启动脚本 (PowerShell)
# 用法: .\scripts\start-server.ps1

param(
    [string]$HostAddr = "0.0.0.0",
    [int]$Port = 8001,
    [switch]$NoMigrate
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Open SkillHub Server Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目根目录
Set-Location $ProjectRoot
Write-Host "[1/3] Project root: $ProjectRoot" -ForegroundColor Green

# 检查 uv 是否可用
try {
    $null = Get-Command uv -ErrorAction Stop
    Write-Host "[2/3] uv found: $(uv --version)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: uv not found. Install it first: https://docs.astral.sh/uv/getting-started/installation/" -ForegroundColor Red
    exit 1
}

# 检查 .env 配置文件
$EnvFile = Join-Path $ProjectRoot "backend\.env"
if (Test-Path $EnvFile) {
    Write-Host "[3/4] Using config file: $EnvFile" -ForegroundColor Green
} else {
    Write-Host "WARNING: .env file not found at $EnvFile" -ForegroundColor Yellow
    Write-Host "         Using default settings from .env.example" -ForegroundColor Yellow
}

# 运行数据库迁移
if (-not $NoMigrate) {
    Write-Host "[4/4] Running database migrations..." -ForegroundColor Green
    uv run python -m alembic -c backend/alembic.ini upgrade head
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Database migration failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "      Migration completed." -ForegroundColor Green
} else {
    Write-Host "[3/3] Skipping database migrations (--no-migrate)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting API server on http://$HostAddr`:$Port ..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

# 启动 uvicorn 服务
uv run python -m uvicorn backend.api_app:app --host $HostAddr --port $Port
