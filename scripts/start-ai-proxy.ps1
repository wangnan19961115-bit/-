param(
  [switch]$SkipHealthCheck
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$EnvPath = Join-Path $Root ".env"
$ProxyScript = Join-Path $Root "scripts\ai-proxy.js"

if (-not (Test-Path -LiteralPath $EnvPath)) {
  Write-Host "Missing .env. Copy .env.example to .env and fill OPENAI_API_KEY." -ForegroundColor Yellow
  exit 1
}

$envLines = Get-Content -LiteralPath $EnvPath -Encoding UTF8
$envMap = @{}
foreach ($line in $envLines) {
  $trimmed = $line.Trim()
  if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
  $index = $trimmed.IndexOf("=")
  if ($index -lt 1) { continue }
  $key = $trimmed.Substring(0, $index).Trim()
  $value = $trimmed.Substring($index + 1).Trim().Trim('"').Trim("'")
  $envMap[$key] = $value
}

if (-not $envMap.OPENAI_API_KEY -or $envMap.OPENAI_API_KEY -eq "sk-your-key") {
  Write-Host "OPENAI_API_KEY is missing or still uses the placeholder." -ForegroundColor Yellow
  exit 1
}

$port = if ($envMap.AI_PROXY_PORT) { [int]$envMap.AI_PROXY_PORT } else { 8788 }
$hostName = if ($envMap.AI_PROXY_HOST) { $envMap.AI_PROXY_HOST } else { "127.0.0.1" }
$baseUrl = "http://${hostName}:${port}"

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  Write-Host "Port $port is already in use. Try health check:" -ForegroundColor Yellow
  Write-Host "$baseUrl/api/health"
  exit 1
}

Write-Host "Starting SymptomMate AI proxy..." -ForegroundColor Cyan
Write-Host "App:    $baseUrl"
Write-Host "Health: $baseUrl/api/health"
Write-Host ""
Write-Host "Press Ctrl+C to stop."
Write-Host ""

Set-Location $Root
node $ProxyScript

if (-not $SkipHealthCheck) {
  try {
    Invoke-RestMethod "$baseUrl/api/health" -TimeoutSec 5 | ConvertTo-Json -Compress
  } catch {
    Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
