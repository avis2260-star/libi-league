
$ErrorActionPreference = "Stop"

# Find python
$pyPath = $null
$candidates = @(
    "C:\Users\Avi_Sab\AppData\Local\Programs\Python\Python314\python.exe",
    "C:\Users\Avi_Sab\AppData\Local\Programs\Python\Python313\python.exe",
    "C:\Python313\python.exe",
    "C:\Python314\python.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $pyPath = $c; break }
}

if (-not $pyPath) {
    Write-Output "No Python found at known paths"
    exit 1
}

Write-Output "Using Python: $pyPath"
& $pyPath --version

$script = @'
import openpyxl, sys, traceback

outfile = r'C:\Users\Avi_Sab\New folder\standings_output.txt'
with open(outfile, 'w', encoding='utf-8') as out:
    def p(s=''):
        out.write(str(s) + '\n')
    try:
        wb = openpyxl.load_workbook(
            r'C:\Users\Avi_Sab\Desktop\ליגת ליבי\2025-6\תוצאות וטבלאות לעונת 2025-6 ליגת ליבי(AutoRecovered).xlsx',
            data_only=True
        )
        p("Sheets: " + str(wb.sheetnames))
        target = None
        for s in wb.sheetnames:
            if 'טבלאות' in s:
                target = s
                break
        if target is None:
            p("No sheet with טבלאות found. All sheets:")
            for s in wb.sheetnames:
                p("  " + s)
        else:
            p(f"Sheet: '{target}'")
            ws = wb[target]
            p(f"Max row: {ws.max_row}, Max col: {ws.max_column}")
            p()
            p("=== ALL NON-EMPTY CELLS ===")
            for row in ws.iter_rows():
                for cell in row:
                    if cell.value is not None:
                        p(f"  R{cell.row}C{cell.column} ({cell.coordinate}): {repr(cell.value)}")
            p()
            p("=== ROW-BY-ROW DUMP ===")
            for row in ws.iter_rows(values_only=True):
                if any(v is not None for v in row):
                    p(str(row))
    except Exception as e:
        p("ERROR: " + str(e))
        p(traceback.format_exc())
'@

$tmpScript = "$env:TEMP\read_xl.py"
$script | Set-Content -Path $tmpScript -Encoding UTF8

& $pyPath $tmpScript
Write-Output "Script finished"
if (Test-Path "C:\Users\Avi_Sab\New folder\standings_output.txt") {
    Write-Output "Output file created!"
    Get-Content "C:\Users\Avi_Sab\New folder\standings_output.txt" -Encoding UTF8
} else {
    Write-Output "Output file NOT created"
}
