$file = "frontend\src\utils\citations.ts"
$content = Get-Content $file -Raw

# Replace pattern: "text - author", with "text (author)",
$pattern = '(".*?)\s+-\s+(.*?)(",)'
$replacement = '$1 ($2)$3'

$newContent = $content -replace $pattern, $replacement

Set-Content -Path $file -Value $newContent -NoNewline
Write-Host "Transformation complete!"
