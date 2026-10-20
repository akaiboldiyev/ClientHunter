$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot 'runtime'
$monitorLog = Join-Path $runtimeDir 'whatsapp-monitor.log'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$entry = [ordered]@{
  checkedAt = (Get-Date).ToUniversalTime().ToString('o')
  health = 'unreachable'
  browser = $null
  autoProcessing = $null
  sendEnabled = $null
  intervalSeconds = $null
  recentServerErrors = @()
  error = $null
}

try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 10
  $runtime = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/jarvis/runtime' -TimeoutSec 10
  $entry.health = $health.status
  $entry.browser = $runtime.browser.status
  $entry.autoProcessing = $runtime.autoProcessing
  $entry.sendEnabled = $runtime.sendEnabled
  $entry.intervalSeconds = $runtime.automationIntervalSec
} catch {
  $entry.error = $_.Exception.Message
}

$serverErrorLog = Join-Path $runtimeDir 'clienthunter-server.err.log'
if (Test-Path -LiteralPath $serverErrorLog) {
  $entry.recentServerErrors = @(Get-Content -LiteralPath $serverErrorLog -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object { [string]$_ })
}

($entry | ConvertTo-Json -Compress) | Add-Content -LiteralPath $monitorLog -Encoding utf8
