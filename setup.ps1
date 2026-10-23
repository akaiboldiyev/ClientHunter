$ErrorActionPreference = 'Stop'
function Require-Command([string]$Name, [string]$Help) { if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "$Name не найден. $Help" } }
Require-Command node 'Установите Node.js LTS с https://nodejs.org/ и перезапустите PowerShell.'
Require-Command npm 'Установите Node.js LTS с https://nodejs.org/ и перезапустите PowerShell.'
Require-Command python 'Установите Python 3.10+ и включите Add Python to PATH.'
npm install
python -m pip install -r requirements.txt
python -m playwright install chromium
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
Write-Host 'Готово. Запустите: .\start.ps1'
