import type {} from '@deepseek-ai/dsh-working-directory'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { getMcpToolRegistryMetadata } from 'cwtools-shared'
import { isReadToolEnabled, isWriteToolEnabled, type Config } from '../config.ts'
import { CWTOOLS_CATALOG, isCwtoolsWriteToolName } from '../contract/toolCatalog.ts'
import { CwtoolsToolError } from './errors.ts'
import { errorFromSharedResult, normalizeSuccessfulResult, renderCwtoolsResult, SUCCESS_OUTPUT_SCHEMA } from './results.ts'
import type { CwtoolsRuntimePool } from './runtime.ts'

/**
 * Register one native DSH tool per shared-catalog entry.
 *
 * Every published tool is registered; whether it is exposed to a session is
 * decided at call time by `runtime.canExpose`, which applies the configuration
 * gate, the project shape and the host capability check. Registration therefore
 * never encodes the catalog — a tool added upstream is registered by this loop
 * with no change here.
 */
export function registerNativeCwtoolsTools(ctx: Context, config: Config, runtime: CwtoolsRuntimePool): () => void {
  const disposers: Array<() => void> = []
  for (const entry of CWTOOLS_CATALOG) {
    // Reads are on by default; every write needs its name in the allowlist.
    if (isCwtoolsWriteToolName(entry.name) ? !isWriteToolEnabled(config, entry.name) : !isReadToolEnabled(config, entry.name)) {
      continue
    }
    const definition = createNativeDefinition(ctx, config, runtime, entry)
    disposers.push(ctx.tools.register(definition, {
      when: async ({ agent, signal }) => {
        const workspaceRoot = await ctx.workingDirectory.ensure(agent, signal)
        return runtime.canExposeWithHost(entry.name, workspaceRoot, signal)
      },
    }))
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

function createNativeDefinition(
  ctx: Context,
  config: Config,
  runtime: CwtoolsRuntimePool,
  schema: { name: string; description: string; inputSchema: Record<string, unknown> },
): ToolDefinition {
  return {
    name: schema.name,
    description: schema.description,
    parameters: schema.inputSchema as ToolDefinition['parameters'],
    timeoutMs: Math.min(2_147_483_647, config.backend.startupTimeoutMs + config.backend.requestTimeoutMs),
    output: {
      schema: SUCCESS_OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderCwtoolsResult(value, config.output.maxResultChars) }],
    },
    isConcurrencySafe: () => getMcpToolRegistryMetadata(schema.name)?.concurrencyClass === 'parallel',
    async execute(args: unknown, exec: ToolRunContext) {
      if (exec.agent === undefined) {
        throw new CwtoolsToolError('workspace_required', 'CWTools tools require an Agent Session working directory.')
      }
      const workspaceRoot = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      const record = typeof args === 'object' && args !== null && !Array.isArray(args)
        ? args as Record<string, unknown>
        : {}
      const result = await runtime.execute(schema.name, record, workspaceRoot, exec.signal)
      if (!result.ok) throw errorFromSharedResult(result)
      return normalizeSuccessfulResult(result)
    },
    presentCall: () => ({ card: 'generic', title: 'CWTools: ' + schema.name }),
  }
}
