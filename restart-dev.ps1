# PowerShell script to kill and restart the development server
# The server runs on port 3001 and serves both backend API and frontend
# Usage: .\restart-dev.ps1

Write-Host "Stopping existing server..." -ForegroundColor Yellow

# Kill processes on port 3001 (unified server)
$serverPort = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($serverPort) {
    $serverPid = $serverPort.OwningProcess
    Write-Host "Killing server process (PID: $serverPid) on port 3001..." -ForegroundColor Yellow
    Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
}

# Kill any tsx processes (backend dev server)
$tsxProcesses = Get-Process -Name "tsx" -ErrorAction SilentlyContinue
if ($tsxProcesses) {
    Write-Host "Killing tsx processes..." -ForegroundColor Yellow
    $tsxProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Kill any node processes on port 3001
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue
        if ($connections -and $connections.LocalPort -eq 3001) {
            Write-Host "Killing node process (PID: $($proc.Id)) on port 3001..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

Write-Host "`nStarting development server..." -ForegroundColor Green
Write-Host "Server: http://localhost:3001" -ForegroundColor Cyan
Write-Host "The server serves both the API and frontend with Vite HMR" -ForegroundColor Cyan
Write-Host "`nServer is starting in a new window..." -ForegroundColor Yellow
Write-Host "Close the window or press Ctrl+C to stop the server.`n" -ForegroundColor Yellow

# Get the current directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath "backend"

# Start the unified server in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev" -WindowStyle Normal

Write-Host "Server started!" -ForegroundColor Green
Write-Host "Check the new PowerShell window for server output." -ForegroundColor Cyan

