# Open SkillHub 启动脚本 (PowerShell)
# 用法: .\scripts\start-server.ps1

param(
    [string]$HostAddr = "0.0.0.0",
    [int]$Port = 8001,
    [switch]$NoMigrate,
    [switch]$SkipConfigCheck
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Test-EnvConfig {
    param([string]$EnvFilePath)

    if (-not (Test-Path $EnvFilePath)) {
        return
    }

    $EnvContent = Get-Content $EnvFilePath -ErrorAction Stop
    $EnvMap = @{}
    foreach ($Line in $EnvContent) {
        $Trimmed = $Line.Trim()
        if ($Trimmed -and -not $Trimmed.StartsWith("#")) {
            $Idx = $Trimmed.IndexOf("=")
            if ($Idx -gt 0) {
                $Key = $Trimmed.Substring(0, $Idx).Trim()
                $Val = $Trimmed.Substring($Idx + 1).Trim()
                $EnvMap[$Key] = $Val
            }
        }
    }

    $HasError = $false

    $DbUrl = $EnvMap["DATABASE_URL"]
    if (-not $DbUrl) {
        Write-Host "      ERROR: DATABASE_URL is not set" -ForegroundColor Red
        $HasError = $true
    } else {
        Write-Host "      DATABASE_URL: OK" -ForegroundColor Green
    }

    $SecretKey = $EnvMap["SECRET_KEY"]
    if (-not $SecretKey) {
        Write-Host "      ERROR: SECRET_KEY is not set" -ForegroundColor Red
        $HasError = $true
    } elseif ($SecretKey.Length -lt 32) {
        Write-Host "      ERROR: SECRET_KEY must be at least 32 characters (current: $($SecretKey.Length))" -ForegroundColor Red
        $HasError = $true
    } else {
        Write-Host "      SECRET_KEY: OK ($($SecretKey.Length) chars)" -ForegroundColor Green
    }

    $DebugMode = $EnvMap["DEBUG"]
    if ($DebugMode -ne "true") {
        $CorsOrigins = $EnvMap["CORS_ORIGINS"]
        if (-not $CorsOrigins -or $CorsOrigins -eq '["*"]') {
            Write-Host "      ERROR: CORS_ORIGINS must be explicitly configured in production mode" -ForegroundColor Red
            $HasError = $true
        } else {
            Write-Host "      CORS_ORIGINS: OK" -ForegroundColor Green
        }
    } else {
        Write-Host "      CORS_ORIGINS: SKIPPED (DEBUG mode)" -ForegroundColor Yellow
    }

    if ($HasError) {
        Write-Host ""
        Write-Host "ERROR: Environment configuration validation failed. Fix the errors above before starting the server." -ForegroundColor Red
        exit 1
    }

    Write-Host "      Configuration validated." -ForegroundColor Green
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Open SkillHub Server Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectRoot
Write-Host "[1/5] Project root: $ProjectRoot" -ForegroundColor Green

try {
    $null = Get-Command uv -ErrorAction Stop
    Write-Host "[2/5] uv found: $(uv --version)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: uv not found. Install it first: https://docs.astral.sh/uv/getting-started/installation/" -ForegroundColor Red
    exit 1
}

$EnvFile = Join-Path $ProjectRoot "backend\.env"
if (Test-Path $EnvFile) {
    Write-Host "[3/5] Using config file: $EnvFile" -ForegroundColor Green
} else {
    Write-Host "WARNING: .env file not found at $EnvFile" -ForegroundColor Yellow
    Write-Host "         Using default settings from .env.example" -ForegroundColor Yellow
}

if (-not $SkipConfigCheck -and (Test-Path $EnvFile)) {
    Write-Host "[4/5] Validating environment configuration..." -ForegroundColor Green
    Test-EnvConfig -EnvFilePath $EnvFile
} else {
    if ($SkipConfigCheck) {
        Write-Host "[4/5] Skipping configuration validation (--skip-config-check)" -ForegroundColor Yellow
    } else {
        Write-Host "[4/5] Skipping configuration validation (no .env file)" -ForegroundColor Yellow
    }
}

if (-not $NoMigrate) {
    Write-Host "[5/5] Running database migrations..." -ForegroundColor Green
    uv run python -m alembic -c backend/alembic.ini upgrade head
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Database migration failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "      Migration completed." -ForegroundColor Green
} else {
    Write-Host "[5/5] Skipping database migrations (--no-migrate)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting API server on http://$HostAddr`:$Port ..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

uv run python -m uvicorn backend.api_app:app --host $HostAddr --port $Port
