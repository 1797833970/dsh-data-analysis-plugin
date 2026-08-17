# @andy1797833970/dsh-skill-data-analysis

Data-analysis skill family: a coarse `data-analysis` orchestrator plus five
focused embedded skills (`data-cleaning`, `eda`, `data-visualization`,
`ml-modeling`, `report-writing`) registered into `ctx.skills`. A reusable Python
toolbox under `toolbox/` ships the same recipes as importable helpers for
deployments that wire `dsh-code-runtime-python.toolboxDirs`.

## Model Experience

Indirectly, through dsh-tool-skill, which renders the skill catalog and loaded instruction body.

#### KV Cache effect

No direct prompt effect; the named consumer owns catalog and instruction rendering.

## Known Limitations and Deferred Work

- **Inline recipes first** — the skills carry their recipes inline; the `toolbox/` import path only activates when `toolboxDirs` and the `toolbox` allowlist entry are configured.
- **Procedure, not enforcement** — the skill guides the model; the gates are ordinary ask_user_question calls.
