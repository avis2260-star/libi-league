
$ErrorActionPreference = "Continue"

$pyPath = "C:\Users\Avi_Sab\AppData\Local\Programs\Python\Python313\python.exe"

# Find the file using PowerShell (handles Unicode paths natively)
$desktopPath = [Environment]::GetFolderPath("Desktop")
Write-Output "Desktop: $desktopPath"

$found = Get-ChildItem -Path $desktopPath -Recurse -Filter "*.xlsx" -ErrorAction SilentlyContinue
foreach ($f in $found) {
    Write-Output "Found: $($f.FullName)"
}

# Try glob in the specific folder
$folder = Join-Path $desktopPath "ליגת ליבי\2025-6"
Write-Output "Looking in: $folder"
if (Test-Path $folder) {
    $files = Get-ChildItem -Path $folder -Filter "*.xlsx"
    foreach ($f in $files) {
        Write-Output "File: $($f.FullName)"
        Write-Output "Name: $($f.Name)"

        # Write the path to a temp file so Python can read it
        $f.FullName | Out-File -FilePath "$env:TEMP\xlsx_path.txt" -Encoding UTF8
        break
    }
} else {
    Write-Output "Folder does not exist: $folder"
    # Try to list what's on the desktop
    Get-ChildItem -Path $desktopPath | Select-Object Name
}
