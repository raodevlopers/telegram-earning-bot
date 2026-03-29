param(
  [string]$GitHubOwner = "raodevlopers",
  [string]$RepoName = "telegram-earning-bot",
  [switch]$Private
)

. "$PSScriptRoot/common.ps1"

$ghPath = Resolve-GhPath

Write-Host "Checking GitHub auth..." -ForegroundColor Yellow
try {
  & $ghPath auth status | Out-Null
} catch {
  throw "GitHub CLI is not authenticated. Run: `"$ghPath`" auth login --web --git-protocol https"
}

$visibilityFlag = if ($Private) { "--private" } else { "--public" }
$fullRepo = "$GitHubOwner/$RepoName"

try {
  & $ghPath repo view $fullRepo | Out-Null
  Write-Host "Repository already exists: $fullRepo" -ForegroundColor Green
} catch {
  Invoke-LoggedCommand -DisplayCommand "`"$ghPath`" repo create $fullRepo $visibilityFlag --source=. --remote=origin --push" -Command "& `"$ghPath`" repo create $fullRepo $visibilityFlag --source=. --remote=origin --push"
}

$currentOrigin = (git remote get-url origin 2>$null)
if (-not $currentOrigin) {
  Invoke-LoggedCommand "git remote add origin https://github.com/$fullRepo.git"
}

Invoke-LoggedCommand "git push -u origin main"
Write-Host "GitHub publish completed for $fullRepo" -ForegroundColor Green
