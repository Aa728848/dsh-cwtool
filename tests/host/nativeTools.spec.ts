import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from '../../src/config.ts'
import { registerNativeCwtoolsTools } from '../../src/host/nativeTools.ts'
import type { CwtoolsRuntimePool } from '../../src/host/runtime.ts'

function config(): Config {
  return {
    enabled: true,
    readGroups: { project: true, localisation: true, semantic: true, navigation: true, diagnostics: true, shader: true },
    readTools: {},
    writeTools: { write_localisation: false },
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
  execute,
} as unknown as CwtoolsRuntimePool

beforeEach(() => {
  definitions.length = 0
  vi.clearAllMocks()
})

 describe('native CWTools registration', () => {
  it('registers 37 read tools by default and the write only after explicit enablement', () => {
    const settings = config()
    const remove = registerNativeCwtoolsTools(ctx, settings, runtime)
    expect(definitions).toHaveLength(37)
    expect(definitions.map(tool => tool.name)).not.toContain('write_localisation')
    expect(definitions.map(tool => tool.name)).not.toContain('get_ide_context')
    remove()

    definitions.length = 0
    settings.writeTools.write_localisation = true
    registerNativeCwtoolsTools(ctx, settings, runtime)
    expect(definitions).toHaveLength(38)
    expect(definitions.map(tool => tool.name)).toContain('write_localisation')
  })

  it('removes exactly the disabled group and individual tool', () => {
    const settings = config()
    settings.readGroups.shader = false
    settings.readTools.query_rules = false
    registerNativeCwtoolsTools(ctx, settings, runtime)
    expect(definitions).toHaveLength(29)
    expect(definitions.map(tool => tool.name)).not.toContain('query_rules')
    expect(definitions.map(tool => tool.name)).not.toContain('validate_shader')
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
