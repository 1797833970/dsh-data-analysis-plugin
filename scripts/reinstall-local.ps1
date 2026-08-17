param(
  [string]$DshRoot = "F:\deepseek_harness",
  [string]$PluginRoot = "F:\deepseek_harness\data-analysis-plugin",
  [string]$Profile = "data-analysis"
)

$ErrorActionPreference = 'Stop'

# dsh resolves its home from $DSH_HOME first, then ~/.dsh. Match that order so
# `dsh --profile` sees the same profile this script installs.
$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) {
  $dshHome = Join-Path $env:USERPROFILE '.dsh'
}
$profileDir = Join-Path $dshHome (Join-Path 'profiles' $Profile)

Write-Host "== 1. Build plugin packages" -ForegroundColor Cyan
& pnpm --dir $PluginRoot build

Write-Host "== 2. Pack plugin packages to local tarballs" -ForegroundColor Cyan
$packDir = Join-Path $env:TEMP 'dsh-plugin-packs'
if (Test-Path -LiteralPath $packDir) { Remove-Item -LiteralPath $packDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $packDir | Out-Null

$packages = @(
  'packages\code-runtime\code-runtime-python',
  'packages\data-analysis\data-analysis',
  'packages\data-analysis\skill-data-analysis',
  'packages\data-analysis\bundle-data-analysis'
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

overrides:
  '@andy1797833970/dsh-code-runtime-python': file:$packUri/andy1797833970-dsh-code-runtime-python-0.1.0.tgz
  '@andy1797833970/dsh-data-analysis': file:$packUri/andy1797833970-dsh-data-analysis-0.1.0.tgz
  '@andy1797833970/dsh-skill-data-analysis': file:$packUri/andy1797833970-dsh-skill-data-analysis-0.1.0.tgz
"@

Set-Content -LiteralPath (Join-Path $profileDir 'package.json') -Value $manifest -Encoding utf8
Set-Content -LiteralPath (Join-Path $profileDir 'cordis.patch.yml') -Value "[]`n" -Encoding utf8
Set-Content -LiteralPath (Join-Path $profileDir 'pnpm-workspace.yaml') -Value $workspace -Encoding utf8

Write-Host "== 4. Install profile" -ForegroundColor Cyan
& pnpm --dir $profileDir install

Write-Host ""
Write-Host "Done. Boot with:" -ForegroundColor Green
Write-Host "  pnpm dsh --profile $Profile"
Write-Host "then open http://127.0.0.1:3080"
