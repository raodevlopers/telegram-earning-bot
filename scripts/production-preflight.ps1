param(
  [switch]$SkipBuild
)

. "$PSScriptRoot/common.ps1"

$envMap = Read-DotEnv

$requiredKeys = @(
  "BOT_TOKEN",
  "BOT_USERNAME",
  "WEBHOOK_BASE_URL",
  "TELEGRAM_WEBHOOK_SECRET",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "ADMIN_PASSWORD_HASH",
  "SESSION_SECRET",
  "ADMIN_AUTH_EMAIL",
  "IMGBB_API_KEY"
)

foreach ($key in $requiredKeys) {
  if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
    throw "Missing required value '$key' in .env"
  }
}

Write-Host "Required environment keys are present." -ForegroundColor Green

$recommendedKeys = @(
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID"
)

foreach ($key in $recommendedKeys) {
  if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
    Write-Host "Warning: '$key' is not set in .env. Admin hosting may fall back to default Firebase web config." -ForegroundColor Yellow
  }
}

$healthUrl = "$($envMap['WEBHOOK_BASE_URL'].TrimEnd('/'))/health"
try {
  $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 20
  if ($healthResponse.status -ne "ok") {
    throw "Unexpected health payload from $healthUrl"
  }
  Write-Host "Backend health check passed at $healthUrl" -ForegroundColor Green
} catch {
  throw "Backend health check failed for $healthUrl. Fix the backend domain before production deployment."
}

if (-not $SkipBuild) {
  Invoke-LoggedCommand "npm run typecheck"
  Invoke-LoggedCommand "npm run test"
  Invoke-LoggedCommand "npm run build"
}

Write-Host "Production preflight passed." -ForegroundColor Green
