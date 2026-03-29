Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [string]$DisplayCommand = $Command
  )

  Write-Host "> $DisplayCommand" -ForegroundColor Cyan
  Invoke-Expression $Command
}

function Read-DotEnv {
  param(
    [string]$Path = ".env"
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing environment file at $Path"
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Resolve-GhPath {
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if ($gh) {
    return $gh.Source
  }

  $fallback = "C:\Program Files\GitHub CLI\gh.exe"
  if (Test-Path -LiteralPath $fallback) {
    return $fallback
  }

  throw "GitHub CLI is not installed."
}

function Require-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is not installed or not in PATH."
  }
}
