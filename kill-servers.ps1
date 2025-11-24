# PowerShell script to kill the development server
# The server runs on port 3001 and serves both backend API and frontend
# Usage: .\kill-servers.ps1

Write-Host "Stopping development server..." -ForegroundColor Yellow

# Kill processes on port 3001 (unified server)
$serverPort = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($serverPort) {
    $serverPid = $serverPort.OwningProcess
    Write-Host "Killing server process (PID: $serverPid) on port 3001..." -ForegroundColor Yellow
    Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
    Write-Host "Server stopped." -ForegroundColor Green
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

# Kill any node processes on port 3001
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $killed = $false
    foreach ($proc in $nodeProcesses) {
        $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue
        if ($connections -and $connections.LocalPort -eq 3001) {
            Write-Host "Killing node process (PID: $($proc.Id)) on port 3001..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killed = $true
        }
    }
    if ($killed) {
        Write-Host "Node processes stopped." -ForegroundColor Green
    }
}

Write-Host "`nServer stopped." -ForegroundColor Green

