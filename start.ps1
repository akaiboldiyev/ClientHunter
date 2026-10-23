$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot

if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }

# Build once per explicit launch, then detach the actual application server
# from this PowerShell/Codex terminal. The server owns the WhatsApp adapter.
npm run build

$listener = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
$nodePath = (Get-Command node -ErrorAction Stop).Source
if ($listener) {
  try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/jarvis/runtime' -TimeoutSec 3
    if ($health.StatusCode -eq 200) {
      Write-Host "ClientHunter is already running at http://localhost:3000 (PID $($listener.OwningProcess))."
      Start-Process 'http://localhost:3000'
      exit 0
    }
  } catch {
    throw "Port 3000 is occupied by PID $($listener.OwningProcess), but its ClientHunter API is unavailable. Stop that process manually, then run this script again."
  }
}
else {
  # Get-NetTCPConnection can be unavailable in restricted Windows sessions.
  # Probe the requested bind address before spawning a server that would fail
  # with EADDRINUSE. This never terminates or reconfigures the current owner.
  $portProbe = 'const net=require("node:net"); const s=net.createServer(); s.once("error",e=>{console.error(e.code||e.message);process.exit(e.code==="EADDRINUSE"?2:1)}); s.listen(3000,"127.0.0.1",()=>s.close(()=>process.exit(0)));'
  $probeOutput = & $nodePath -e $portProbe 2>&1
  $probeExitCode = $LASTEXITCODE
  if ($probeExitCode -eq 2) {
    throw 'Port 3000 is occupied, but this session cannot identify its owner. No process was stopped; inspect the owner before retrying.'
  }
  if ($probeExitCode -ne 0) {
    throw "Cannot safely verify whether port 3000 is available: $probeOutput"
  }
}

$runtimeDir = Join-Path $projectRoot 'runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$stdoutLog = Join-Path $runtimeDir 'clienthunter-server.out.log'
$stderrLog = Join-Path $runtimeDir 'clienthunter-server.err.log'
Start-Process -FilePath $nodePath -ArgumentList 'dist/server.cjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 250
  if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) { break }
}

if (-not (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue)) {
  throw "ClientHunter did not start. Check $stderrLog"
}

Start-Process 'http://localhost:3000'
Write-Host 'ClientHunter is running independently: http://localhost:3000'
