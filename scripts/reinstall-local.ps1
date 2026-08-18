param(
  [string]$DshRoot = "F:\deepseek_harness",
  [string]$PluginRoot = "F:\deepseek_harness\data-analysis-plugin",
  [string]$Profile = "data-analysis"
)

$ErrorActionPreference = 'Stop'

$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) {
  $userHome = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
  if ([string]::IsNullOrWhiteSpace($userHome)) {
    throw 'Cannot resolve the dsh home directory. Set DSH_HOME explicitly.'
  }
  $dshHome = Join-Path $userHome '.dsh'
}
$profileDir = Join-Path $dshHome (Join-Path 'profiles' $Profile)

Write-Host '== 1. Build plugin packages' -ForegroundColor Cyan
& pnpm --dir $PluginRoot build

Write-Host '== 2. Pack plugin packages to local tarballs' -ForegroundColor Cyan
$packDir = Join-Path ([System.IO.Path]::GetTempPath()) 'dsh-plugin-packs'
if (Test-Path -LiteralPath $packDir) { Remove-Item -LiteralPath $packDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $packDir | Out-Null

$packages = @(
  'packages/code-runtime/code-runtime-python',
  'packages/data-analysis/data-analysis',
  'packages/data-analysis/skill-data-analysis',
  'packages/data-analysis/bundle-data-analysis',
  'packages/client/ui-data-analysis'
)
foreach ($pkg in $packages) {
  & pnpm --dir (Join-Path $PluginRoot $pkg) pack --pack-destination $packDir | Out-Null
}

Write-Host "== 3. Recreate profile $Profile at $profileDir" -ForegroundColor Cyan
if (Test-Path -LiteralPath $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

$packUri = $packDir.Replace('\', '/')
$manifest = @"
{
  "name": "dsh-profile-$Profile",
  "private": true,
  "dependencies": {
    "@deepseek-ai/dsh-web-app": "0.1.0-rc.6",
    "@andy1797833970/dsh-bundle-data-analysis": "file:$packUri/andy1797833970-dsh-bundle-data-analysis-0.1.0.tgz"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@andy1797833970/dsh-bundle-data-analysis"
      ]
    }
  }
}
"@

$workspace = @"
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false

allowBuilds:
  koffi: true
  node-pty: true
  '@deepseek-ai/dsh-subprocess-local': true

overrides:
  '@andy1797833970/dsh-code-runtime-python': file:$packUri/andy1797833970-dsh-code-runtime-python-0.1.0.tgz
  '@andy1797833970/dsh-data-analysis': file:$packUri/andy1797833970-dsh-data-analysis-0.1.0.tgz
  '@andy1797833970/dsh-skill-data-analysis': file:$packUri/andy1797833970-dsh-skill-data-analysis-0.1.0.tgz
  '@andy1797833970/dsh-client-ui-data-analysis': file:$packUri/andy1797833970-dsh-client-ui-data-analysis-0.1.0.tgz
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $profileDir 'package.json'), $manifest, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $profileDir 'cordis.patch.yml'), "[]`n", $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $profileDir 'pnpm-workspace.yaml'), $workspace, $utf8NoBom)

Write-Host '== 4. Install profile' -ForegroundColor Cyan
& pnpm --dir $profileDir install

Write-Host '== 5. Install the data-analysis agent preset' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'install-preset.ps1') -PluginRoot $PluginRoot

Write-Host ''
Write-Host 'Done. Start from the dsh source directory:' -ForegroundColor Green
Write-Host "  cd $DshRoot"
Write-Host "  pnpm dsh --profile $Profile"
Write-Host 'then open http://127.0.0.1:3080'
