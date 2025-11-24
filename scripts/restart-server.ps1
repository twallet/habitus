# Restart the backend server
# This script kills the existing server and starts it again in the same terminal

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent $scriptPath
$backendPath = Join-Path $rootPath "backend"

Write-Host "Restarting backend server..." -ForegroundColor Yellow

# Kill existing server
& "$scriptPath\kill-server.ps1"

# Wait a moment for the process to fully terminate
Start-Sleep -Seconds 1

Write-Host "Starting backend server..." -ForegroundColor Green
Write-Host "Server will be available at http://localhost:3001" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Change to backend directory and start the server
Set-Location $backendPath
npm run dev

