# @andy1797833970/dsh-bundle-data-analysis

Profile bundle for the data-analysis agent: a patch layer composing the Python
code runtime, the data-analysis tools, and the runtime skill.

## Model Experience

Indirectly, through the inserted plugin rows, whose packages own every model-facing registration.

#### KV Cache effect

No direct invalidation; inserted row packages own any request-prefix changes.

## Known Limitations

- **Patch-only composition** — the bundle inserts the host rows; the agent preset and client wiring are separate surfaces.
- **Single runtime** — the Python backend replaces the TypeScript worker, so this bundle cannot stack beside dsh-code-runtime-worker-thread.
