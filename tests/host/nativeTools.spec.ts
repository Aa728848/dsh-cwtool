import type { Context } from '@deepseek-ai/cordis'
import { CWTOOLS_READ_TOOL_GROUPS, CWTOOLS_READ_TOOL_NAMES } from '../../src/contract/toolCatalog.ts'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from '../../src/config.ts'
import { registerNativeCwtoolsTools } from '../../src/host/nativeTools.ts'
import type { CwtoolsRuntimePool } from '../../src/host/runtime.ts'

function config(): Config {
  return {
    enabled: true,
    readGroups: {
      project: true, localisation: true, semantic: true, navigation: true,
      diagnostics: true, shader: true, ide: true,
    },
    readTools: {},
    writeTools: {},
    diagnostics: { ignoreCodes: [], ignoreFiles: [], localisationFilter: 'off' as const },
    backend: {
      serverPath: '', gamePath: '', rulesPath: '', cachePath: '', game: '', forceStart: false,
      startupTimeoutMs: 30_000, requestTimeoutMs: 20_000, idleShutdownMs: 600_000,
      maxWorkspaceRuntimes: 2,
      preferActiveBackend: false,
      activeManifestPath: '', debug: false,
    },
    output: { maxResultChars: 16_000 },
  }
}

const definitions: ToolDefinition[] = []
const register = vi.fn((definition: ToolDefinition) => {
  definitions.push(definition)
  return () => {}
})
const ensure = vi.fn(async () => '/mod')
const ctx = {
  tools: { register },
  workingDirectory: { ensure },
} as unknown as Context
const execute = vi.fn(async () => ({ ok: true, status: 'ready', source: 'test', data: { value: 1 } }))
const runtime = {
  canExpose: vi.fn(() => true),
  canExposeWithHost: vi.fn(async () => true),
  execute,
} as unknown as CwtoolsRuntimePool

beforeEach(() => {
  definitions.length = 0
  vi.clearAllMocks()
})

 describe('native CWTools registration', () => {
  it('registers every shared read tool and no write until it is allowlisted', () => {
    const reads = [...CWTOOLS_READ_TOOL_NAMES]
    const settings = config()
    const remove = registerNativeCwtoolsTools(ctx, settings, runtime)
    expect(definitions.map(tool => tool.name).sort()).toEqual([...reads].sort())
    // A shared read tool this package never named is registered too: the catalog
    // is the source of truth, not a compiled first-release list.
    expect(definitions.map(tool => tool.name)).toContain('get_ide_context')
    expect(definitions.map(tool => tool.name)).not.toContain('write_localisation')
    remove()

    definitions.length = 0
    settings.writeTools.write_localisation = true
    registerNativeCwtoolsTools(ctx, settings, runtime)
    expect(definitions).toHaveLength(reads.length + 1)
    expect(definitions.map(tool => tool.name)).toContain('write_localisation')
  })

  it('removes exactly the disabled group and individual tool', () => {
    const shader = CWTOOLS_READ_TOOL_GROUPS.shader
    expect(shader.length).toBeGreaterThan(0)
    const settings = config()
    settings.readGroups.shader = false
    settings.readTools.query_rules = false
    registerNativeCwtoolsTools(ctx, settings, runtime)
    const names = definitions.map(tool => tool.name)
    expect(names).not.toContain('query_rules')
    for (const name of shader) expect(names).not.toContain(name)
    expect(definitions).toHaveLength(CWTOOLS_READ_TOOL_NAMES.length - shader.length - 1)
    expect(names).toContain('query_types')
  })

  it('gates exposure through the runtime rather than registration', async () => {
    const canExpose = vi.fn((name: string) => name !== 'open_in_visual_editor')
    const gated = { canExpose, canExposeWithHost: canExpose, execute } as unknown as CwtoolsRuntimePool
    const definitionsWithGate: ToolDefinition[] = []
    const gatedCtx = {
      tools: { register: (definition: ToolDefinition, options: { when: (input: { agent: unknown; signal: AbortSignal }) => Promise<boolean> }) => {
        definitionsWithGate.push(definition)
        options.when({ agent: { session: { id: 'session' } }, signal: new AbortController().signal })
          .then((visible) => { if (!visible) definitionsWithGate.splice(definitionsWithGate.indexOf(definition), 1) })
        return () => {}
      } },
      workingDirectory: { ensure },
    } as unknown as Context
    registerNativeCwtoolsTools(gatedCtx, config(), gated)
    await vi.waitFor(() => { expect(canExpose).toHaveBeenCalledWith('query_types', '/mod', expect.any(AbortSignal)) })
    expect(canExpose).toHaveBeenCalledWith('open_in_visual_editor', '/mod', expect.any(AbortSignal))
  })

  it('requires an Agent workspace before execution', async () => {
    registerNativeCwtoolsTools(ctx, config(), runtime)
    const definition = definitions.find(tool => tool.name === 'query_types')
    expect(definition).toBeDefined()
    await expect(definition!.execute({}, { signal: new AbortController().signal } as ToolRunContext)).rejects.toMatchObject({ code: 'workspace_required' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('uses the Session cwd and returns the canonical result', async () => {
    registerNativeCwtoolsTools(ctx, config(), runtime)
    const definition = definitions.find(tool => tool.name === 'query_types')!
    const agent = { session: { id: 'session' } }
    const result = await definition.execute({ typeName: 'ship_size' }, {
      agent,
      signal: new AbortController().signal,
    } as ToolRunContext)
    expect(ensure).toHaveBeenCalled()
    expect(execute).toHaveBeenCalledWith('query_types', { typeName: 'ship_size' }, '/mod', expect.any(AbortSignal))
    expect(result).toMatchObject({ ok: true, status: 'ready', data: { value: 1 } })
  })
})