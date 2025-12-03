# Stop all Node.js processes and remove the data directory
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Remove-Item -Path "data" -Recurse -Force -ErrorAction SilentlyContinue

