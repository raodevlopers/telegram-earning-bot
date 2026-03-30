param(
  [string]$ProjectName = "telegram-earning-bot",
  [string]$ServiceName = "bot-backend"
)

. "$PSScriptRoot/common.ps1"

Require-Command railway
$envMap = Read-DotEnv

Write-Host "Checking Railway auth..." -ForegroundColor Yellow
try {
  railway whoami | Out-Null
} catch {
  throw "Railway CLI is not authenticated. Run: railway login"
}

$requiredKeys = @(
  "BOT_TOKEN",
  "BOT_USERNAME",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "ADMIN_PASSWORD_HASH",
  "SESSION_SECRET",
  "IMGBB_API_KEY"
)

foreach ($key in $requiredKeys) {
  if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
    throw "Missing required value '$key' in .env"
  }
}

if ($envMap["FIREBASE_CLIENT_EMAIL"] -like "replace-with*" -or $envMap["FIREBASE_PRIVATE_KEY"] -like "*replace-with*") {
  throw "Firebase Admin credentials are still placeholders in .env. Add a service-account client email and private key before Railway deployment."
}

if (-not $envMap.ContainsKey("TELEGRAM_WEBHOOK_SECRET") -or $envMap["TELEGRAM_WEBHOOK_SECRET"] -like "replace-with*") {
  $envMap["TELEGRAM_WEBHOOK_SECRET"] = [guid]::NewGuid().Guid.Replace("-", "")
}

Write-Host "Creating or linking Railway project..." -ForegroundColor Yellow
try {
  railway status --json | Out-Null
} catch {
  Invoke-LoggedCommand "railway init --name $ProjectName"
}

try {
  Invoke-LoggedCommand "railway add --service $ServiceName"
} catch {
  Write-Host "Service may already exist, continuing..." -ForegroundColor DarkYellow
}

$domainJsonRaw = ""
try {
  Write-Host "> railway domain --service $ServiceName --port 3000 --json" -ForegroundColor Cyan
  $domainJsonRaw = railway domain --service $ServiceName --port 3000 --json
} catch {
  Write-Host "Could not pre-generate Railway domain before deploy. The script will continue and you can rerun it after the first deployment." -ForegroundColor DarkYellow
}

if ($domainJsonRaw) {
  try {
    $domainJson = $domainJsonRaw | ConvertFrom-Json
    if ($domainJson.domain) {
      $envMap["WEBHOOK_BASE_URL"] = "https://$($domainJson.domain)"
    } elseif ($domainJson.url) {
      $envMap["WEBHOOK_BASE_URL"] = $domainJson.url
    }
  } catch {
    Write-Host "Domain JSON could not be parsed automatically." -ForegroundColor DarkYellow
  }
}

if (-not $envMap.ContainsKey("WEBHOOK_BASE_URL") -or $envMap["WEBHOOK_BASE_URL"] -like "https://your-*") {
  throw "WEBHOOK_BASE_URL is still a placeholder. Generate or assign a Railway domain first, then rerun this script."
}

if (-not $envMap.ContainsKey("PORT")) {
  $envMap["PORT"] = "3000"
}

$plainVars = @(
  "PORT",
  "BOT_USERNAME",
  "WEBHOOK_BASE_URL",
  "FIREBASE_PROJECT_ID",
  "ADMIN_ORIGIN",
  "ADMIN_AUTH_EMAIL",
  "TASK_REWARD_PAISE",
  "REFERRAL_REWARD_PAISE",
  "MIN_WITHDRAWAL_PAISE",
  "TASK_VERIFY_COOLDOWN_SECONDS",
  "TASK_TIMER_SECONDS",
  "DAILY_REMINDER_MIN",
  "DAILY_REMINDER_MAX",
  "REMINDER_SCAN_INTERVAL_MS"
)

foreach ($key in $plainVars) {
  if ($envMap.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($envMap[$key])) {
    Invoke-LoggedCommand "railway variable set $key=$($envMap[$key]) --service $ServiceName"
  }
}

$secretVars = @(
  "BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "ADMIN_PASSWORD_HASH",
  "SESSION_SECRET",
  "IMGBB_API_KEY"
)

foreach ($key in $secretVars) {
  Write-Host "> railway variable set --stdin $key --service $ServiceName" -ForegroundColor Cyan
  $envMap[$key] | railway variable set --stdin $key --service $ServiceName | Out-Null
}

Invoke-LoggedCommand "railway up --service $ServiceName --detach"

Write-Host "> railway domain --service $ServiceName --port 3000 --json" -ForegroundColor Cyan
$finalDomain = railway domain --service $ServiceName --port 3000 --json
Write-Host $finalDomain
Write-Host "Railway deployment command completed." -ForegroundColor Green
