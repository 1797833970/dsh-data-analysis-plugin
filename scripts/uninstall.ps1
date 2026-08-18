param(
  [string]$PluginRoot = "F:\deepseek_harness\data-analysis-plugin",
  [string]$Profile = "data-analysis",
  [switch]$RemoveVenv
)

$ErrorActionPreference = 'Stop'

function Assert-ChildPath {
  param(
    [string]$Root,
    [string]$Child,
    [string]$Label
  )
  $root = [System.IO.Path]::GetFullPath($Root)
  $child = [System.IO.Path]::GetFullPath($Child)
  if (-not $child.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label is outside its expected root: $child"
  }
  return $child
}

function Remove-SafeDirectory {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
    Write-Host "Removed $Path"
  } else {
    Write-Host "Already absent: $Path"
  }
}

$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) {
  $userHome = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
  if ([string]::IsNullOrWhiteSpace($userHome)) {
    throw 'Cannot resolve the dsh home directory. Set DSH_HOME explicitly.'
  }
  $dshHome = Join-Path $userHome '.dsh'
}

$profileDir = Assert-ChildPath $dshHome (Join-Path $dshHome "profiles\$Profile") 'Profile path'
$presetDir = Assert-ChildPath $dshHome (Join-Path $dshHome ".agent-presets\$Profile") 'Preset path'

Remove-SafeDirectory $profileDir
Remove-SafeDirectory $presetDir

if ($RemoveVenv) {
  $venvDir = Assert-ChildPath $PluginRoot (Join-Path $PluginRoot '.venv') 'Venv path'
  Remove-SafeDirectory $venvDir
} else {
  Write-Host 'Kept plugin-local .venv. Pass -RemoveVenv to remove it too.'
}

Write-Host ''
Write-Host "Uninstalled profile '$Profile' and its agent preset."
