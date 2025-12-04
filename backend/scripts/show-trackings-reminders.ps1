# PowerShell script to display all trackings and their reminders from the Habitus database
# Shows trackings with their associated reminders

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
$tempScript = Join-Path $env:TEMP "habitus-query-trackings-$(Get-Date -Format 'yyyyMMddHHmmss').js"

$backendNodeModules = Join-Path $backendRoot "node_modules"
$projectNodeModules = Join-Path $projectRoot "node_modules"

# Escape paths for JavaScript (replace backslashes with double backslashes, and escape single quotes)
# Use .Replace() for literal string replacement (not regex)
# In PowerShell, use backtick to escape backslash in single-quoted strings
$escapedBackendNodeModules = $backendNodeModules.Replace("`\", "\\").Replace("'", "\'")
$escapedProjectNodeModules = $projectNodeModules.Replace("`\", "\\").Replace("'", "\'")
$escapedDbPath = $dbPath.Replace("`\", "\\").Replace("'", "\'")

$nodeScript = @"
const path = require('path');
const fs = require('fs');

// Try to require sqlite3 - check multiple possible locations
let sqlite3;
const backendNodeModules = '$escapedBackendNodeModules';
const projectNodeModules = '$escapedProjectNodeModules';

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

const dbPath = '$escapedDbPath';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

// Get all trackings (excluding deleted ones)
db.all(
  'SELECT ' +
  '  t.id, ' +
  '  t.user_id, ' +
  '  u.name as user_name, ' +
  '  u.email as user_email, ' +
  '  t.question, ' +
  '  t.type, ' +
  '  t.notes, ' +
  '  t.icon, ' +
  '  t.days, ' +
  '  t.state, ' +
  '  t.created_at, ' +
  '  t.updated_at ' +
  'FROM trackings t ' +
  'LEFT JOIN users u ON t.user_id = u.id ' +
  "WHERE t.state != 'Deleted' " +
  'ORDER BY t.user_id, t.created_at DESC',
  (err, trackingRows) => {
  if (err) {
    console.error('Error querying trackings:', err.message);
    db.close();
    process.exit(1);
  }

  if (!trackingRows || trackingRows.length === 0) {
    console.log(JSON.stringify({ trackings: [] }));
    db.close();
    return;
  }

  // Get all reminders
  db.all(
    'SELECT ' +
    '  r.id, ' +
    '  r.tracking_id, ' +
    '  r.user_id, ' +
    '  r.scheduled_time, ' +
    '  r.answer, ' +
    '  r.notes, ' +
    '  r.status, ' +
    '  r.created_at, ' +
    '  r.updated_at ' +
    'FROM reminders r ' +
    'ORDER BY r.tracking_id, r.scheduled_time ASC',
    (err, reminderRows) => {
    if (err) {
      console.error('Error querying reminders:', err.message);
      db.close();
      process.exit(1);
    }

    // Get all tracking schedules
    db.all(
      'SELECT ' +
      '  ts.tracking_id, ' +
      '  ts.hour, ' +
      '  ts.minutes ' +
      'FROM tracking_schedules ts ' +
      'ORDER BY ts.tracking_id, ts.hour, ts.minutes',
      (err, scheduleRows) => {
      if (err) {
        console.error('Error querying schedules:', err.message);
        db.close();
        process.exit(1);
      }

      // Group reminders by tracking_id
      const remindersByTracking = {};
      (reminderRows || []).forEach(reminder => {
        if (!remindersByTracking[reminder.tracking_id]) {
          remindersByTracking[reminder.tracking_id] = [];
        }
        remindersByTracking[reminder.tracking_id].push(reminder);
      });

      // Group schedules by tracking_id
      const schedulesByTracking = {};
      (scheduleRows || []).forEach(schedule => {
        if (!schedulesByTracking[schedule.tracking_id]) {
          schedulesByTracking[schedule.tracking_id] = [];
        }
        schedulesByTracking[schedule.tracking_id].push({
          hour: schedule.hour,
          minutes: schedule.minutes
        });
      });

      // Combine trackings with their reminders and schedules
      const trackings = trackingRows.map(tracking => ({
        id: tracking.id,
        user_id: tracking.user_id,
        user_name: tracking.user_name,
        user_email: tracking.user_email,
        question: tracking.question,
        type: tracking.type,
        notes: tracking.notes,
        icon: tracking.icon,
        days: tracking.days,
        state: tracking.state,
        created_at: tracking.created_at,
        updated_at: tracking.updated_at,
        schedules: schedulesByTracking[tracking.id] || [],
        reminders: remindersByTracking[tracking.id] || []
      }));

      const result = {
        count: trackings.length,
        trackings: trackings
      };

      console.log(JSON.stringify(result));
      db.close();
    });
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
    Write-Host "Total number of trackings: $($result.count)" -ForegroundColor Green
    
    if ($result.trackings.Count -eq 0) {
        Write-Host "No trackings found in the database." -ForegroundColor Yellow
    } else {
        $trackingIndex = 0
        foreach ($tracking in $result.trackings) {
            $trackingIndex++
            
            # Add empty line before each tracking (except the first one)
            if ($trackingIndex -gt 1) {
                Write-Host ""
            }
            
            # Format schedules as comma-separated list
            $schedulesStr = if ($tracking.schedules.Count -gt 0) {
                $scheduleTimes = $tracking.schedules | ForEach-Object {
                    "{0:D2}:{1:D2}" -f $_.hour, $_.minutes
                }
                $scheduleTimes -join ", "
            } else {
                "None"
            }
            
            # Build tracking attributes string
            $trackingAttrs = @(
                "ID=$($tracking.id)",
                "UserID=$($tracking.user_id)",
                "UserName=$($tracking.user_name)",
                "UserEmail=$($tracking.user_email)",
                "Question=$($tracking.question)",
                "Type=$($tracking.type)",
                "State=$($tracking.state)",
                "Icon=$($tracking.icon)",
                "Days=$($tracking.days)",
                "Schedules=[$schedulesStr]",
                "Notes=$($tracking.notes)",
                "Created=$($tracking.created_at)",
                "Updated=$($tracking.updated_at)"
            )
            
            # Display tracking in one line
            $stateColor = switch ($tracking.state) {
                "Running" { "Green" }
                "Paused" { "Yellow" }
                default { "White" }
            }
            
            Write-Host ("TRACKING #$trackingIndex : " + ($trackingAttrs -join " | ")) -ForegroundColor $stateColor
            
            # Display reminders with all attributes, indented
            if ($tracking.reminders.Count -gt 0) {
                foreach ($reminder in $tracking.reminders) {
                    # Format scheduled time: convert ISO string to readable format
                    $scheduledTime = $reminder.scheduled_time
                    if ($scheduledTime) {
                        try {
                            $dateTime = [DateTime]::Parse($scheduledTime)
                            $scheduledTimeFormatted = $dateTime.ToString("yyyy-MM-dd HH:mm:ss")
                        } catch {
                            # If parsing fails, use the ISO string as-is
                            $scheduledTimeFormatted = $scheduledTime
                        }
                    } else {
                        $scheduledTimeFormatted = "null"
                    }
                    
                    # Format answer and notes (handle null/empty)
                    $answerStr = if ($reminder.answer) { $reminder.answer } else { "null" }
                    $notesStr = if ($reminder.notes) { $reminder.notes } else { "null" }
                    
                    # Build reminder attributes string
                    $reminderAttrs = @(
                        "ID=$($reminder.id)",
                        "TrackingID=$($reminder.tracking_id)",
                        "UserID=$($reminder.user_id)",
                        "ScheduledTime=$scheduledTimeFormatted",
                        "Status=$($reminder.status)",
                        "Answer=$answerStr",
                        "Notes=$notesStr",
                        "Created=$($reminder.created_at)",
                        "Updated=$($reminder.updated_at)"
                    )
                    
                    $statusColor = switch ($reminder.status) {
                        "Pending" { "Yellow" }
                        "Answered" { "Green" }
                        "Upcoming" { "Cyan" }
                        default { "Gray" }
                    }
                    
                    Write-Host ("  -> REMINDER : " + ($reminderAttrs -join " | ")) -ForegroundColor $statusColor
                }
            } else {
                Write-Host "  -> REMINDERS: None" -ForegroundColor Gray
            }
        }
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

