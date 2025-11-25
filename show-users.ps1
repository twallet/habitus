# PowerShell script to display users from the Habitus database
# Shows the number of users and their name + email

param(
    [string]$DbPath = ""
)

# Get the script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = $scriptDir

# Determine database path
if ([string]::IsNullOrEmpty($DbPath)) {
    # Check for DB_PATH environment variable
    $envDbPath = $env:DB_PATH
    if (-not [string]::IsNullOrEmpty($envDbPath)) {
        if ([System.IO.Path]::IsPathRooted($envDbPath)) {
            $dbPath = $envDbPath
        } else {
            $dbPath = Join-Path $projectRoot "backend" $envDbPath
        }
    } else {
        # Default path: backend/data/habitus.db
        $dbPath = Join-Path $projectRoot "backend" "data" "habitus.db"
    }
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

$nodeScript = @"
const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = '$($dbPath.Replace('\', '\\'))';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

// Get count of users
db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
  if (err) {
    console.error('Error querying database:', err.message);
    db.close();
    process.exit(1);
  }
  
  const count = row ? row.count : 0;
  console.log(JSON.stringify({ count: count }));
  
  // Get all users with name and email
  db.all('SELECT id, name, email FROM users ORDER BY id', (err, rows) => {
    if (err) {
      console.error('Error querying users:', err.message);
      db.close();
      process.exit(1);
    }
    
    console.log(JSON.stringify({ users: rows || [] }));
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
    
    # Execute the Node.js script and capture output
    $output = node $tempScript 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error executing query:" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
    
    # Parse JSON output - filter out error stream and split by lines
    $jsonLines = $output | Where-Object { $_ -match '^\s*\{' } | ForEach-Object { $_.Trim() }
    
    if ($jsonLines.Count -lt 2) {
        Write-Host "Error: Unexpected output from database query" -ForegroundColor Red
        Write-Host "Output: $output"
        exit 1
    }
    
    $countData = $jsonLines[0] | ConvertFrom-Json
    $usersData = $jsonLines[1] | ConvertFrom-Json
    
    # Display results
    Write-Host "Total number of users: $($countData.count)" -ForegroundColor Green
    Write-Host ""
    
    if ($usersData.users.Count -eq 0) {
        Write-Host "No users found in the database." -ForegroundColor Yellow
    } else {
        Write-Host "Users:" -ForegroundColor Green
        Write-Host ("=" * 80)
        Write-Host ("{0,-5} {1,-30} {2,-40}" -f "ID", "Name", "Email")
        Write-Host ("-" * 80)
        
        foreach ($user in $usersData.users) {
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

