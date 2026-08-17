# Running the plugin

## Published install (recommended)

Once the `@andy1797833970/*` packages are published:

```sh
dsh plugin --profile data-analysis add @andy1797833970/dsh-bundle-data-analysis
dsh plugin --profile data-analysis install
dsh --profile data-analysis
```

The profile directory is `$DSH_HOME/profiles/data-analysis`. Its `package.json`
lists `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and
`@andy1797833970/dsh-bundle-data-analysis` as bundle layers, in that order.

## Source install (before publishing)

From a checkout that has both `deepseek-harness` and this repository as
siblings, add the local package to a profile:

```sh
cd "$DSH_HOME/profiles/data-analysis"
pnpm add <path-to-this-repo>/packages/data-analysis/bundle-data-analysis
dsh --profile data-analysis
```

## Python

```sh
./scripts/setup-python.sh   # macOS/Linux
scripts/setup-python.ps1    # Windows PowerShell
```

This creates `./.venv`, installs `requirements-data-analysis.txt`, and points
`DSH_PYTHON` at the venv interpreter.
