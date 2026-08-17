/**
 * Package-owned invariant companion for `@andy1797833970/dsh-bundle-data-analysis`.
 * @module @andy1797833970/dsh-bundle-data-analysis/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@andy1797833970/dsh-bundle-data-analysis'

/** Cordis companion plugin name. */
export const name = 'bundle-data-analysis-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: the bundle is patch-only; cordis config verification covers composition. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
