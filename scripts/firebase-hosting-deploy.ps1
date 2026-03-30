param(
  [string]$ProjectId = "hybrid-engineer",
  [string]$ApiBaseUrl
)

. "$PSScriptRoot/common.ps1"

Require-Command firebase
$envMap = Read-DotEnv

if (-not $ApiBaseUrl) {
  if ($envMap.ContainsKey("WEBHOOK_BASE_URL") -and -not [string]::IsNullOrWhiteSpace($envMap["WEBHOOK_BASE_URL"])) {
    $ApiBaseUrl = $envMap["WEBHOOK_BASE_URL"]
  } else {
    throw "Pass the Railway backend URL with -ApiBaseUrl, for example: -ApiBaseUrl https://your-service.up.railway.app"
  }
}

$env:VITE_API_BASE_URL = $ApiBaseUrl.TrimEnd("/")
if ($envMap.ContainsKey("VITE_FIREBASE_API_KEY")) { $env:VITE_FIREBASE_API_KEY = $envMap["VITE_FIREBASE_API_KEY"] }
if ($envMap.ContainsKey("VITE_FIREBASE_AUTH_DOMAIN")) { $env:VITE_FIREBASE_AUTH_DOMAIN = $envMap["VITE_FIREBASE_AUTH_DOMAIN"] }
if ($envMap.ContainsKey("VITE_FIREBASE_DATABASE_URL")) { $env:VITE_FIREBASE_DATABASE_URL = $envMap["VITE_FIREBASE_DATABASE_URL"] }
if ($envMap.ContainsKey("VITE_FIREBASE_PROJECT_ID")) { $env:VITE_FIREBASE_PROJECT_ID = $envMap["VITE_FIREBASE_PROJECT_ID"] }
if ($envMap.ContainsKey("VITE_FIREBASE_STORAGE_BUCKET")) { $env:VITE_FIREBASE_STORAGE_BUCKET = $envMap["VITE_FIREBASE_STORAGE_BUCKET"] }
if ($envMap.ContainsKey("VITE_FIREBASE_MESSAGING_SENDER_ID")) { $env:VITE_FIREBASE_MESSAGING_SENDER_ID = $envMap["VITE_FIREBASE_MESSAGING_SENDER_ID"] }
if ($envMap.ContainsKey("VITE_FIREBASE_APP_ID")) { $env:VITE_FIREBASE_APP_ID = $envMap["VITE_FIREBASE_APP_ID"] }
if ($envMap.ContainsKey("VITE_ADMIN_AUTH_EMAIL")) {
  $env:VITE_ADMIN_AUTH_EMAIL = $envMap["VITE_ADMIN_AUTH_EMAIL"]
} elseif ($envMap.ContainsKey("ADMIN_AUTH_EMAIL")) {
  $env:VITE_ADMIN_AUTH_EMAIL = $envMap["ADMIN_AUTH_EMAIL"]
}

$healthUrl = "$($env:VITE_API_BASE_URL)/health"
try {
  $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 20
  if ($healthResponse.status -ne "ok") {
    throw "Unexpected health payload from $healthUrl"
  }
  Write-Host "Backend health check passed at $healthUrl" -ForegroundColor Green
} catch {
  throw "Backend health check failed for $healthUrl. Deploy or fix the backend URL before hosting deploy."
}

Invoke-LoggedCommand "npm run build -w admin"
Invoke-LoggedCommand "firebase use $ProjectId"
Invoke-LoggedCommand "firebase deploy --only firestore:rules,firestore:indexes,hosting"

Write-Host "Firebase Hosting + Firestore rules deployment completed for project $ProjectId" -ForegroundColor Green
