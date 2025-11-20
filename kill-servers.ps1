# PowerShell script to kill backend and frontend servers
# Usage: .\kill-servers.ps1

Write-Host "Stopping servers..." -ForegroundColor Yellow

# Kill processes on port 3000 (frontend)
$frontendPort = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($frontendPort) {
    $frontendPid = $frontendPort.OwningProcess
    Write-Host "Killing frontend process (PID: $frontendPid) on port 3000..." -ForegroundColor Yellow
    Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
    Write-Host "Frontend stopped." -ForegroundColor Green
}
else {
    Write-Host "No process found on port 3000." -ForegroundColor Gray
}

# Kill processes on port 3001 (backend)
$backendPort = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($backendPort) {
    $backendPid = $backendPort.OwningProcess
    Write-Host "Killing backend process (PID: $backendPid) on port 3001..." -ForegroundColor Yellow
    Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
    Write-Host "Backend stopped." -ForegroundColor Green
}
else {
    Write-Host "No process found on port 3001." -ForegroundColor Gray
}

# Kill any tsx processes (backend dev server)
$tsxProcesses = Get-Process -Name "tsx" -ErrorAction SilentlyContinue
if ($tsxProcesses) {
    Write-Host "Killing tsx processes..." -ForegroundColor Yellow
    $tsxProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "tsx processes stopped." -ForegroundColor Green
}

# Kill any node processes on ports 3000 or 3001
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $killed = $false
    foreach ($proc in $nodeProcesses) {
        $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue
        if ($connections -and ($connections.LocalPort -eq 3000 -or $connections.LocalPort -eq 3001)) {
            Write-Host "Killing node process (PID: $($proc.Id)) on port $($connections.LocalPort)..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killed = $true
        }
    }
    if ($killed) {
        Write-Host "Node processes stopped." -ForegroundColor Green
    }
}

Write-Host "`nAll servers stopped." -ForegroundColor Green

