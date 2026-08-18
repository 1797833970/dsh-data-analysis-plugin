param(
  [string]$PluginRoot = "F:\deepseek_harness\data-analysis-plugin"
)

$ErrorActionPreference = 'Stop'

$source = Join-Path $PluginRoot 'deferred\agent-preset-data-analysis'
$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) {
  $userHome = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
  if ([string]::IsNullOrWhiteSpace($userHome)) {
    throw 'Cannot resolve the dsh home directory. Set DSH_HOME explicitly.'
  }
  $dshHome = Join-Path $userHome '.dsh'
}
$dest = Join-Path $dshHome '.agent-presets\data-analysis'

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -LiteralPath (Join-Path $source 'agent.cordis.yml') -Destination $dest -Force
Copy-Item -LiteralPath (Join-Path $source 'preset.yml') -Destination $dest -Force

Write-Host "Installed data-analysis preset to $dest"
