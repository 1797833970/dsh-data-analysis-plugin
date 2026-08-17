# @andy1797833970/dsh-code-runtime-python

Python process backend for the code-execution seam: runs one model-written
Python program against host tool bindings in a sandboxed subprocess.

## What it does

Registers `ctx.codeRuntime` with `language: 'python'` and `isolation:
'process'`. Each `run()` spawns `python` through `ctx.subprocess`, wraps the
argv through `ctx.sandbox`, and bridges `await tools.name(args)` calls over
newline-delimited JSON on stdio. A Python-side AST guard blocks dangerous
imports and calls; wall-clock timeout, tree termination, and an outer-output
cap bound each run. Runs are stateless: no DataFrame survives between runs.

## Configuration

`pythonCommand`, `allowedModules`, `pythonEnv`, `timeoutMs`, `graceMs`, and
`maxOutputBytes` are validated deployment choices, never hidden defaults.

## Model Experience

Indirectly, through Code Mode in dsh-tools, which exposes run_code and renders the Python runtime's logs, value, and failures.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- **Soft boundary** — the import guard plus the file sandbox are not a container; network and syscall isolation are deferred.
- **Stateless runs only** — no persistent kernel; intermediate data must persist as files between stages.
- **No streaming logs** — logs arrive only on the settled result.
