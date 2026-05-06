# SkillDrive Desktop Client Launcher (PowerShell)
# Usage: .\scripts\start-desktop-client.ps1

param(
    [string]$ApiUrl = "http://127.0.0.1:8001"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DesktopDir = Join-Path $ProjectRoot "desktop-client"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SkillDrive Desktop Client Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $DesktopDir "package.json"))) {
    Write-Host "ERROR: Desktop client directory not found at $DesktopDir" -ForegroundColor Red
    exit 1
}

Push-Location $DesktopDir
Write-Host "[1/4] Desktop client directory: $DesktopDir" -ForegroundColor Green

try {
    $nodeVersion = node --version
    Write-Host "[2/4] Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found. Install it first: https://nodejs.org/" -ForegroundColor Red
    Pop-Location
    exit 1
}

$NodeModulesPath = Join-Path $DesktopDir "node_modules"
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
    Write-Host "[3/4] Dependencies already installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "Building and starting Electron app..." -ForegroundColor Cyan
Write-Host "API Base URL: $ApiUrl" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

$env:SKILLDRIVE_API_BASE_URL = $ApiUrl
npm run start:electron
