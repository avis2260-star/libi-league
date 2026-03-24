
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$pyPath = "C:\Users\Avi_Sab\AppData\Local\Programs\Python\Python313\python.exe"

$desktopPath = [Environment]::GetFolderPath("Desktop")
$allXlsx = Get-ChildItem -Path $desktopPath -Recurse -Filter "*AutoRecovered*.xlsx" -ErrorAction SilentlyContinue
$targetFile = $allXlsx | Where-Object { $_.DirectoryName -match "2025-6" } | Select-Object -First 1

if ($targetFile) {
    # Write WITHOUT BOM
    $enc = New-Object System.Text.UTF8Encoding($false)  # false = no BOM
    [System.IO.File]::WriteAllText("$env:TEMP\xlsx_path.txt", $targetFile.FullName, $enc)
    Write-Output "Target file: $($targetFile.FullName)"

    $pyScript = @'
import openpyxl, sys, os

path_file = os.path.join(os.environ['TEMP'], 'xlsx_path.txt')
with open(path_file, 'r', encoding='utf-8') as f:
    xlsx_path = f.read().strip().lstrip('\ufeff')

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
            p("Found sheet: '" + target + "'")
            ws = wb[target]
            p("Max row: " + str(ws.max_row) + ", Max col: " + str(ws.max_column))
            p()
            p("=== ALL NON-EMPTY CELLS ===")
            for row in ws.iter_rows():
                for cell in row:
                    if cell.value is not None:
                        p("  R" + str(cell.row) + "C" + str(cell.column) + " (" + cell.coordinate + "): " + repr(cell.value))
            p()
            p("=== ROW-BY-ROW (values only) ===")
            for i, row in enumerate(ws.iter_rows(values_only=True), 1):
                if any(v is not None for v in row):
                    p("Row " + str(i) + ": " + str(row))
    except Exception as e:
        p("ERROR: " + str(e))
        import traceback
        p(traceback.format_exc())
'@

    $enc2 = New-Object System.Text.UTF8Encoding($false)
    $tmpPy = "$env:TEMP\read_xl3.py"
    [System.IO.File]::WriteAllText($tmpPy, $pyScript, $enc2)

    & $pyPath $tmpPy
    Write-Output "Python done"

    if (Test-Path "C:\Users\Avi_Sab\New folder\standings_output.txt") {
        Write-Output "=== OUTPUT ==="
        Get-Content "C:\Users\Avi_Sab\New folder\standings_output.txt" -Encoding UTF8
    }
}
