# PowerShell script to kill and restart backend and frontend servers
# Usage: .\restart-dev.ps1

Write-Host "Stopping existing servers..." -ForegroundColor Yellow

# Kill processes on port 3000 (frontend)
$frontendPort = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($frontendPort) {
    $frontendPid = $frontendPort.OwningProcess
    Write-Host "Killing frontend process (PID: $frontendPid) on port 3000..." -ForegroundColor Yellow
    Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
}

# Kill processes on port 3001 (backend)
$backendPort = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($backendPort) {
    $backendPid = $backendPort.OwningProcess
    Write-Host "Killing backend process (PID: $backendPid) on port 3001..." -ForegroundColor Yellow
    Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
}

# Kill any tsx processes (backend dev server)
$tsxProcesses = Get-Process -Name "tsx" -ErrorAction SilentlyContinue
if ($tsxProcesses) {
    Write-Host "Killing tsx processes..." -ForegroundColor Yellow
    $tsxProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Kill any node processes that might be running vite (frontend dev server)
# This is more aggressive - kills node processes on port 3000
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue
        if ($connections -and ($connections.LocalPort -eq 3000 -or $connections.LocalPort -eq 3001)) {
            Write-Host "Killing node process (PID: $($proc.Id)) on port $($connections.LocalPort)..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

Write-Host "`nStarting servers..." -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "`nServers are starting in separate windows..." -ForegroundColor Yellow
Write-Host "Close the windows or press Ctrl+C in each window to stop the servers.`n" -ForegroundColor Yellow

# Get the current directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath "backend"
$frontendPath = Join-Path $scriptPath "frontend"

# Start backend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev" -WindowStyle Normal

# Wait a moment before starting frontend
Start-Sleep -Seconds 1

# Start frontend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal

Write-Host "Both servers started!" -ForegroundColor Green
Write-Host "Check the new PowerShell windows for server output." -ForegroundColor Cyan

