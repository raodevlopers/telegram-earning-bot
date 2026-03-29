param(
  [string]$ProjectId = "hybrid-engineer",
  [string]$ApiBaseUrl
)

. "$PSScriptRoot/common.ps1"

Require-Command firebase

if (-not $ApiBaseUrl) {
  throw "Pass the Railway backend URL with -ApiBaseUrl, for example: -ApiBaseUrl https://your-service.up.railway.app"
}

$env:VITE_API_BASE_URL = $ApiBaseUrl.TrimEnd("/")
if ($env:ADMIN_AUTH_EMAIL) {
  $env:VITE_ADMIN_AUTH_EMAIL = $env:ADMIN_AUTH_EMAIL
}

Invoke-LoggedCommand "npm run build -w admin"
Invoke-LoggedCommand "firebase use $ProjectId"
Invoke-LoggedCommand "firebase deploy --only hosting"

Write-Host "Firebase Hosting deployment completed for project $ProjectId" -ForegroundColor Green
