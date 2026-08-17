/**
 * Data-analysis wizard UI, node half.
 *
 * Deliberately empty. The `analysis/*` events are produced by the host-side
 * `@deepseek-ai/dsh-data-analysis` tools; this package only renders them in the
 * browser half, so the node composition owns no model-facing surface.
 * @module @deepseek-ai/dsh-client-ui-data-analysis
 */

/** Host plugin body — chart and report nodes are rendered in the browser half. */
export function apply(): void {}
