# Kill the backend server running on port 3001
# This script finds and stops the server process using the port

Write-Host "Stopping backend server..." -ForegroundColor Yellow

# Find process using port 3001
$port = 3001
$connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($connection) {
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "Found server process (PID: $processId, Name: $($process.ProcessName))" -ForegroundColor Cyan
        Stop-Process -Id $processId -Force
        Write-Host "Server stopped successfully." -ForegroundColor Green
    } else {
        Write-Host "Port $port is in use but process not found." -ForegroundColor Yellow
    }
} else {
    Write-Host "No server found running on port $port." -ForegroundColor Yellow
}

