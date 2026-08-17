param(
  [string]$DshRoot = "F:\deepseek_harness",
  [string]$PluginRoot = "F:\deepseek_harness\data-analysis-plugin",
  [string]$Profile = "data-analysis"
)

$ErrorActionPreference = 'Stop'

Write-Host "== 1. Build plugin packages (copy lib from dsh in-repo prototypes)" -ForegroundColor Cyan
$pairs = @(
  @("packages\code-runtime\code-runtime-python", "packages\code-runtime\code-runtime-python"),
  @("packages\data-analysis\data-analysis",       "packages\data-analysis\data-analysis"),
  @("packages\data-analysis\skill-data-analysis", "packages\data-analysis\skill-data-analysis"),
  @("packages\data-analysis\bundle-data-analysis","packages\data-analysis\bundle-data-analysis")
)
foreach ($p in $pairs) {
  $src = Join-Path $DshRoot ($p[0] + "\lib")
  $dst = Join-Path $PluginRoot ($p[1] + "\lib")
  if (-not (Test-Path -LiteralPath $src)) { throw "missing in-repo lib: $src" }
  if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
  Copy-Item -LiteralPath $src -Destination $dst -Recurse
}

Write-Host "== 2. Create profile $Profile" -ForegroundColor Cyan
$profileDir = Join-Path (Join-Path (Join-Path $env:USERPROFILE '.dsh') 'profiles') $Profile
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
@"
{
  "name": "dsh-profile-$Profile",
  "private": true,
  "dependencies": {},
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
"@ | Set-Content -LiteralPath (Join-Path $profileDir 'package.json') -Encoding utf8
if (-not (Test-Path -LiteralPath (Join-Path $profileDir 'cordis.patch.yml'))) {
  "[]" | Set-Content -LiteralPath (Join-Path $profileDir 'cordis.patch.yml') -Encoding utf8
}
@"
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
"@ | Set-Content -LiteralPath (Join-Path $profileDir 'pnpm-workspace.yaml') -Encoding utf8

Write-Host "== 3. Add plugin packages by file path" -ForegroundColor Cyan
$pluginPkgs = @(
  "packages\code-runtime\code-runtime-python",
  "packages\data-analysis\data-analysis",
  "packages\data-analysis\skill-data-analysis",
  "packages\data-analysis\bundle-data-analysis"
)
foreach ($p in $pluginPkgs) {
  $path = Join-Path $PluginRoot $p
  & pnpm --dir $profileDir add "file:$path"
}

Write-Host "== 4. Install profile" -ForegroundColor Cyan
& pnpm --dir $profileDir install

Write-Host ""
Write-Host "Done. Boot with:" -ForegroundColor Green
Write-Host "  pnpm dsh --profile $Profile"
Write-Host "then open http://127.0.0.1:3080"
