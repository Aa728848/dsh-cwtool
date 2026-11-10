import type { Context } from '@deepseek-ai/cordis'
// Type-only: the Loader declares the `loader/volatile-update` event this plugin listens to.
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { snapshotConfig, type CwtoolsLiveConfig } from './config.ts'
import { registerNativeCwtoolsTools } from './host/nativeTools.ts'
import { CWTOOLS_SYSTEM_PROMPT } from './host/prompt.ts'
import { CwtoolsRuntimePool } from './host/runtime.ts'

export { Config } from './config.ts'
export const name = 'cwtools'
export const inject = ['tools', 'systemPrompt', 'workingDirectory']

/** Register native CWTools tools and own every runtime resource in one effect.
 * A settings save commits volatile values into this running instance, so the
 * resources that capture them are rebuilt instead of waiting for a restart.
 * @param ctx - the Host plugin context.
 * @param config - the live configuration sections this entry owns.
 */
export function apply(ctx: Context, config: CwtoolsLiveConfig): void {
  let dispose: (() => void) | undefined

  const mount = (): void => {
    const values = snapshotConfig(config)
    if (!values.enabled) return
    const runtime = new CwtoolsRuntimePool(values)
    const removePrompt = ctx.systemPrompt.section({
      name: 'tool:cwtools',
      order: 2210,
      text: CWTOOLS_SYSTEM_PROMPT,
    })
    const removeTools = registerNativeCwtoolsTools(ctx, values, runtime)
    dispose = () => {
      removeTools()
      removePrompt()
      runtime.dispose()
    }
  }

  const unmount = (): void => {
    const current = dispose
    dispose = undefined
    current?.()
  }

  ctx.effect(() => {
    mount()
    return unmount
  }, 'cwtools: native tools and workspace runtimes')

  ctx.on('loader/volatile-update', () => {
    unmount()
    mount()
  })
}
