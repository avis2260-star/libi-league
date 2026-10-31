# Uploads the league Excel file to the site - the same as the admin page's
# Excel sync tab, but from the desktop, without logging in.
#
# The site only accepts this upload together with a secret key. Setup (once):
#   1. Make a key: run this line in PowerShell and copy the result.
#        $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $_.ToString('x2') })
#   2. In Vercel: the project -> Settings -> Environment Variables -> add
#        Name: EXCEL_SYNC_TOKEN   Value: <the key>   Environment: Production
#      then redeploy (Deployments -> ... -> Redeploy) so the site picks it up.
#   3. Paste the same key into $syncKey below.
# Keep this file private: anyone with the key can update the league tables.
# To change the key, repeat steps 1-3. To turn the script off, delete
# EXCEL_SYNC_TOKEN in Vercel and redeploy.

$filePath = "$env:USERPROFILE\Desktop\libi.xlsx"
$siteUrl  = "https://libi-league.vercel.app/api/admin/sync-excel-file"
$syncKey  = "PASTE-THE-KEY-HERE"

# Show the site's Hebrew messages correctly.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ($syncKey -eq "PASTE-THE-KEY-HERE" -or $syncKey.Length -lt 32) {
    Write-Host "ERROR: paste the secret key into `$syncKey first (see the steps at the top of this file)." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}
if (-not (Test-Path $filePath)) {
    Write-Host "ERROR: file not found: $filePath" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Uploading Excel file..." -ForegroundColor Yellow

$result = $null
try {
    $result = curl.exe -s -X POST $siteUrl -H "Authorization: Bearer $syncKey" -F "file=@$filePath"
    $json = $result | ConvertFrom-Json

    if ($json.success) {
        Write-Host "SUCCESS! $($json.message)" -ForegroundColor Green
    } elseif ($json.error -eq "Unauthorized") {
        Write-Host "ERROR: Unauthorized - the key in this file does not match EXCEL_SYNC_TOKEN in Vercel, or the site was not redeployed after setting it." -ForegroundColor Red
    } else {
        Write-Host "ERROR: $($json.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    if ($result) { Write-Host $result }
}

Read-Host "Press Enter to close"
