# Open SkillHub Frontend Launcher (PowerShell)
# Usage: .\scripts\start-frontend.ps1

param(
    [int]$Port = 3000,
    [string]$ApiUrl = "http://localhost:8001"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FrontendDir = Join-Path $ProjectRoot "frontend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Open SkillHub Frontend Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $FrontendDir "package.json"))) {
    Write-Host "ERROR: Frontend directory not found at $FrontendDir" -ForegroundColor Red
    exit 1
}

Push-Location $FrontendDir
Write-Host "[1/3] Frontend directory: $FrontendDir" -ForegroundColor Green

try {
    $nodeVersion = node --version
    Write-Host "[2/3] Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found. Install it first: https://nodejs.org/" -ForegroundColor Red
    Pop-Location
    exit 1
}

$NodeModulesPath = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $NodeModulesPath)) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "[3/3] Dependencies already installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Next.js dev server on http://localhost:$Port ..." -ForegroundColor Cyan
Write-Host "API Base URL: $ApiUrl" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

$env:NEXT_PUBLIC_API_BASE_URL = $ApiUrl
npm run dev -- --port $Port
