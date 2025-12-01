# PowerShell script to display users from the Habitus database
# Shows the number of users and their name + email

param(
    [string]$DbPath = ""
)

# Get the script directory, backend root, and project root
# Script is in backend/scripts/ directory, so backend root is one level up
# Project root (habitus/) is two levels up from the script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $backendRoot

# Determine database path
# Priority: 1) Custom -DbPath parameter, 2) DB_PATH environment variable, 3) Default path
if ([string]::IsNullOrEmpty($DbPath)) {
    # Check for DB_PATH environment variable
    $envDbPath = $env:DB_PATH
    if (-not [string]::IsNullOrEmpty($envDbPath)) {
        if ([System.IO.Path]::IsPathRooted($envDbPath)) {
            # Absolute path: use as-is
            $dbPath = $envDbPath
        } else {
            # Relative path: resolve relative to project root
            $dbPath = Join-Path $projectRoot $envDbPath
        }
    } else {
        # Default path: project root/data/habitus.db
        # Example: D:\Code\habitus\data\habitus.db
        $dataDir = Join-Path $projectRoot "data"
        $dbPath = Join-Path $dataDir "habitus.db"
    }
} else {
    # If custom path provided, make it absolute if it's relative
    if (-not [System.IO.Path]::IsPathRooted($DbPath)) {
        # Relative path: resolve relative to project root
        $dbPath = Join-Path $projectRoot $DbPath
    } else {
        # Absolute path: use as-is
        $dbPath = $DbPath
    }
}

# Ensure the path is absolute
try {
    $dbPath = [System.IO.Path]::GetFullPath($dbPath)
} catch {
    Write-Host "Error: Invalid database path: $dbPath" -ForegroundColor Red
    exit 1
}

# Check if database file exists
if (-not (Test-Path $dbPath)) {
    Write-Host "Error: Database file not found at: $dbPath" -ForegroundColor Red
    exit 1
}

Write-Host "Querying database: $dbPath" -ForegroundColor Cyan
Write-Host ""

# Create a temporary Node.js script to query the database
$tempScript = Join-Path $env:TEMP "habitus-query-users-$(Get-Date -Format 'yyyyMMddHHmmss').js"

$backendNodeModules = Join-Path $backendRoot "node_modules"
$projectNodeModules = Join-Path $projectRoot "node_modules"
$nodeScript = @"
const path = require('path');
const fs = require('fs');

// Try to require sqlite3 - check multiple possible locations
let sqlite3;
const backendNodeModules = '$($backendNodeModules.Replace('\', '\\'))';
const projectNodeModules = '$($projectNodeModules.Replace('\', '\\'))';

// Try direct require first (will work if NODE_PATH is set correctly)
try {
  sqlite3 = require('sqlite3');
} catch (e) {
  // Try backend/node_modules/sqlite3
  const backendSqlite3 = path.join(backendNodeModules, 'sqlite3');
  if (fs.existsSync(backendSqlite3)) {
    sqlite3 = require(backendSqlite3);
  } else {
    // Try project root/node_modules/sqlite3 (for npm workspaces)
    const projectSqlite3 = path.join(projectNodeModules, 'sqlite3');
    if (fs.existsSync(projectSqlite3)) {
      sqlite3 = require(projectSqlite3);
    } else {
      throw new Error('Cannot find sqlite3 module. Tried: require("sqlite3"), ' + backendSqlite3 + ', ' + projectSqlite3);
    }
  }
}

const dbPath = '$($dbPath.Replace('\', '\\'))';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

// Get count of users
db.get('SELECT COUNT(*) as count FROM users', (err, countRow) => {
  if (err) {
    console.error('Error querying database:', err.message);
    db.close();
    process.exit(1);
  }
  
  const count = countRow ? countRow.count : 0;
  
  // Get all users with name and email
  db.all('SELECT id, name, email FROM users ORDER BY id', (err, rows) => {
    if (err) {
      console.error('Error querying users:', err.message);
      db.close();
      process.exit(1);
    }
    
    const result = {
      count: count,
      users: rows || []
    };
    
    console.log(JSON.stringify(result));
    db.close();
  });
});
"@

try {
    # Write the temporary script
    $nodeScript | Out-File -FilePath $tempScript -Encoding UTF8
    
    # Check if Node.js is available
    $nodeVersion = node --version 2>$null
    if (-not $nodeVersion) {
        Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
        exit 1
    }
    
    # Execute the Node.js script from backend directory to ensure sqlite3 module is found
    # Set NODE_PATH to include both backend and project root node_modules (for npm workspaces)
    $originalNodePath = $env:NODE_PATH
    if ($originalNodePath) {
        $env:NODE_PATH = "$backendNodeModules;$projectNodeModules;$originalNodePath"
    } else {
        $env:NODE_PATH = "$backendNodeModules;$projectNodeModules"
    }
    Push-Location $backendRoot
    try {
        $output = node $tempScript 2>&1
    } finally {
        Pop-Location
        # Restore NODE_PATH
        if ($originalNodePath) {
            $env:NODE_PATH = $originalNodePath
        } else {
            Remove-Item Env:\NODE_PATH -ErrorAction SilentlyContinue
        }
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error executing query:" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
    
    # Parse JSON output - get the JSON line (filter out any error messages)
    $jsonOutput = $output | Where-Object { $_ -match '^\s*\{' } | Select-Object -First 1
    
    if (-not $jsonOutput) {
        Write-Host "Error: Could not parse database query output" -ForegroundColor Red
        Write-Host "Output: $output"
        exit 1
    }
    
    try {
        $result = $jsonOutput.Trim() | ConvertFrom-Json
    } catch {
        Write-Host "Error: Failed to parse JSON output" -ForegroundColor Red
        Write-Host "Output: $jsonOutput"
        exit 1
    }
    
    # Display results
    Write-Host "Total number of users: $($result.count)" -ForegroundColor Green
    Write-Host ""
    
    if ($result.users.Count -eq 0) {
        Write-Host "No users found in the database." -ForegroundColor Yellow
    } else {
        Write-Host "Users:" -ForegroundColor Green
        Write-Host ("=" * 80)
        Write-Host ("{0,-5} {1,-30} {2,-40}" -f "ID", "Name", "Email")
        Write-Host ("-" * 80)
        
        foreach ($user in $result.users) {
            $name = if ($user.name) { $user.name } else { "" }
            $email = if ($user.email) { $user.email } else { "" }
            Write-Host ("{0,-5} {1,-30} {2,-40}" -f $user.id, $name, $email)
        }
        
        Write-Host ("=" * 80)
    }
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clean up temporary script
    if (Test-Path $tempScript) {
        Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
    }
}

