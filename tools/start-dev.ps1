# Starts TransitOps locally in two windows (API + frontend) and opens http://localhost:3000.
#   powershell -ExecutionPolicy Bypass -File tools\start-dev.ps1           # your normal database (User Secrets)
#   powershell -ExecutionPolicy Bypass -File tools\start-dev.ps1 -TestDb   # local test database + mail catcher
param([switch]$TestDb)

$repo = Split-Path $PSScriptRoot -Parent
$api = Join-Path $repo "backend\TransitOps.Api\TransitOps.Api.csproj"

# Stop copies left running from an earlier start so the ports are free.
Get-Process TransitOps.Api -ErrorAction SilentlyContinue | Stop-Process -Force

if ($TestDb) {
    if (-not (Test-Path (Join-Path $repo "tools\testdb\node_modules"))) {
        npm --prefix (Join-Path $repo "tools\testdb") install
    }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='TransitOps test database'; node '$repo\tools\testdb\start.mjs'"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='TransitOps mail catcher'; python '$repo\tools\mailsink\mailsink.py'"
    Start-Sleep -Seconds 8
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$repo\tools\run-api-testdb.ps1"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='TransitOps API'; dotnet run --project '$api'"
}

if (-not (Test-Path (Join-Path $repo "frontend\node_modules"))) {
    npm --prefix (Join-Path $repo "frontend") install
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='TransitOps frontend'; npm --prefix '$repo\frontend' run dev"

Write-Host "Waiting for the API to start..."
for ($i = 0; $i -lt 120; $i++) {
    try {
        Invoke-WebRequest "http://localhost:3000/api/onboarding/plans" -UseBasicParsing -TimeoutSec 2 | Out-Null
        break
    } catch { Start-Sleep -Seconds 2 }
}
Start-Process "http://localhost:3000"
Write-Host "TransitOps is running at http://localhost:3000. Close the opened windows to stop it."
