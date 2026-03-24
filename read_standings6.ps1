
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$pyPath = "C:\Users\Avi_Sab\AppData\Local\Programs\Python\Python313\python.exe"

$desktopPath = [Environment]::GetFolderPath("Desktop")
$allXlsx = Get-ChildItem -Path $desktopPath -Recurse -Filter "*AutoRecovered*.xlsx" -ErrorAction SilentlyContinue
$targetFile = $allXlsx | Where-Object { $_.DirectoryName -match "2025-6" } | Select-Object -First 1

if ($targetFile) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText("$env:TEMP\xlsx_path.txt", $targetFile.FullName, $enc)

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
        sheets = wb.sheetnames
        p("Sheets: " + str(sheets))
        p("Sheet bytes: " + str([s.encode('utf-8') for s in sheets]))

        # Use index 3 (0-based) which is 'טבלאות' based on the list
        # Sheets: ['קבוצות ', 'תוצאות', 'חישובים', 'טבלאות', 'טורניר גביע', 'Sheet1']
        target_sheet = sheets[3]
        p("Using sheet index 3: " + repr(target_sheet))
        ws = wb[target_sheet]
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
    $tmpPy = "$env:TEMP\read_xl4.py"
    [System.IO.File]::WriteAllText($tmpPy, $pyScript, $enc2)

    & $pyPath $tmpPy
    Write-Output "Python done"

    if (Test-Path "C:\Users\Avi_Sab\New folder\standings_output.txt") {
        Write-Output "=== OUTPUT ==="
        Get-Content "C:\Users\Avi_Sab\New folder\standings_output.txt" -Encoding UTF8
    }
}
