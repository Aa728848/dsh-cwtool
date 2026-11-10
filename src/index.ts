import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.ts'
import { registerNativeCwtoolsTools } from './host/nativeTools.ts'
import { CWTOOLS_SYSTEM_PROMPT } from './host/prompt.ts'
import { CwtoolsRuntimePool } from './host/runtime.ts'

export { Config } from './config.ts'
export const name = 'cwtools'
export const inject = ['tools', 'systemPrompt', 'workingDirectory']

/** Register native CWTools tools and own every runtime resource in one effect. */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  ctx.effect(() => {
    const runtime = new CwtoolsRuntimePool(config)
    const removePrompt = ctx.systemPrompt.section({
      name: 'tool:cwtools',
      order: 2210,
      text: CWTOOLS_SYSTEM_PROMPT,
    })
    const removeTools = registerNativeCwtoolsTools(ctx, config, runtime)
    return () => {
      removeTools()
      removePrompt()
      runtime.dispose()
    }
  }, 'cwtools: native tools and workspace runtimes')
}
