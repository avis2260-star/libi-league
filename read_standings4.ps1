
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$pyPath = "C:\Users\Avi_Sab\AppData\Local\Programs\Python\Python313\python.exe"

# Find the target Excel file
$desktopPath = [Environment]::GetFolderPath("Desktop")
$folder2025 = Get-ChildItem -Path $desktopPath -Directory | Where-Object { $_.Name -match "2025" -or $true } | ForEach-Object {
    Get-ChildItem -Path $_.FullName -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "2025-6" }
} | Select-Object -First 1

# Direct approach: find the AutoRecovered xlsx in 2025-6 subfolder
$allXlsx = Get-ChildItem -Path $desktopPath -Recurse -Filter "*AutoRecovered*.xlsx" -ErrorAction SilentlyContinue
Write-Output "AutoRecovered xlsx files:"
foreach ($f in $allXlsx) {
    Write-Output "  $($f.FullName)"
}

# Find the specific file containing "2025-6" in its path
$targetFile = $allXlsx | Where-Object { $_.DirectoryName -match "2025-6" } | Select-Object -First 1
if (-not $targetFile) {
    $targetFile = $allXlsx | Where-Object { $_.Name -match "2025" } | Select-Object -First 1
}

Write-Output "Target: $($targetFile.FullName)"

if ($targetFile) {
    # Write path to temp file
    [System.IO.File]::WriteAllText("$env:TEMP\xlsx_path.txt", $targetFile.FullName, [System.Text.Encoding]::UTF8)
    Write-Output "Path written to temp file"

    # Now run python with a script that reads the path from the temp file
    $pyScript = @'
import openpyxl, sys, os

# Read path from temp file
path_file = os.path.join(os.environ['TEMP'], 'xlsx_path.txt')
with open(path_file, 'r', encoding='utf-8') as f:
    xlsx_path = f.read().strip()

outfile = r'C:\Users\Avi_Sab\New folder\standings_output.txt'
with open(outfile, 'w', encoding='utf-8') as out:
    def p(s=''):
        out.write(str(s) + '\n')

    p("Opening: " + xlsx_path)
    try:
        wb = openpyxl.load_workbook(xlsx_path, data_only=True)
        p("Sheets: " + str(wb.sheetnames))

        target = None
        for s in wb.sheetnames:
            if 'טבלאות' in s:
                target = s
                break

        if target is None:
            p("No sheet with טבלאות found.")
            for s in wb.sheetnames:
                p("  Sheet: " + s)
        else:
            p(f"Found sheet: '{target}'")
            ws = wb[target]
            p(f"Max row: {ws.max_row}, Max col: {ws.max_column}")
            p()
            p("=== ALL NON-EMPTY CELLS ===")
            for row in ws.iter_rows():
                for cell in row:
                    if cell.value is not None:
                        p(f"  R{cell.row}C{cell.column} ({cell.coordinate}): {repr(cell.value)}")
            p()
            p("=== ROW-BY-ROW (values only) ===")
            for i, row in enumerate(ws.iter_rows(values_only=True), 1):
                if any(v is not None for v in row):
                    p(f"Row {i}: {row}")
    except Exception as e:
        p("ERROR: " + str(e))
        import traceback
        p(traceback.format_exc())
'@

    $tmpPy = "$env:TEMP\read_xl2.py"
    [System.IO.File]::WriteAllText($tmpPy, $pyScript, [System.Text.Encoding]::UTF8)

    & $pyPath $tmpPy
    Write-Output "Python done"

    if (Test-Path "C:\Users\Avi_Sab\New folder\standings_output.txt") {
        Write-Output "=== OUTPUT FILE CONTENTS ==="
        Get-Content "C:\Users\Avi_Sab\New folder\standings_output.txt" -Encoding UTF8
    } else {
        Write-Output "Output file not created"
    }
}
