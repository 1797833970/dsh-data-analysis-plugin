$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root '.venv'
$requirements = Join-Path $root 'requirements-data-analysis.txt'

if (-not (Test-Path $venv)) {
    python -m venv $venv
}

$python = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path $python)) {
    $python = Join-Path $venv 'bin\python'
}

& $python -m pip install --upgrade pip
& $python -m pip install -r $requirements

Write-Host ''
Write-Host "Python environment ready: $python"
Write-Host "Set DSH_PYTHON to this interpreter so dsh uses it:"
Write-Host "  [Environment]::SetEnvironmentVariable('DSH_PYTHON', '$python', 'User')"
$set = Read-Host 'Set DSH_PYTHON in your user environment now? [y/N]'
if ($set -eq 'y') {
    [Environment]::SetEnvironmentVariable('DSH_PYTHON', $python, 'User')
    Write-Host 'DSH_PYTHON set for new terminals. Restart the terminal to pick it up.'
}
