import { describe, expect, it } from 'vitest'
import { allowedWriteTools, Config, isReadToolEnabled, isWriteToolEnabled, snapshotConfig } from '../../src/config.ts'

/** The two schema properties the Host's settings projection reads. */
interface SchemaNode {
  meta?: { volatile?: boolean }
  dict?: Record<string, SchemaNode>
  inner?: SchemaNode
  list?: SchemaNode[]
  type?: string
}

/** Mirror of the Host's isVolatilePath rule: a path is editable only below a volatile node. */
function isVolatilePath(node: SchemaNode, path: readonly string[]): boolean {
  if (node.meta?.volatile === true) return true
  const [key, ...rest] = path
  const child = key === undefined ? undefined : node.dict?.[key]
  return child !== undefined && isVolatilePath(child, rest)
}

/** Visit every leaf a settings form renders, keyed by its dotted path. */
function leaves(node: SchemaNode, path: string[] = []): string[][] {
  if (node.type === 'object') {
    const children = Object.entries(node.dict ?? {})
    if (children.length === 0) return [path]
    return children.flatMap(([key, child]) => leaves(child, [...path, key]))
  }
  return [path]
}

describe('CWTools configuration', () => {
  it('resolves safe defaults', () => {
    const config = snapshotConfig(Config({}))
    expect(config.enabled).toBe(true)
    expect(config.readGroups.semantic).toBe(true)
    expect(config.writeTools).toEqual({})
    expect(config.backend.maxWorkspaceRuntimes).toBe(2)
    expect(config.backend.forceStart).toBe(false)
    expect(config.backend.preferActiveBackend).toBe(true)
    expect(config.backend.activeManifestPath).toBe('')
    expect(config.output.maxResultChars).toBe(16_000)
    expect(config.diagnostics).toEqual({ ignoreCodes: [], ignoreFiles: [], localisationFilter: 'off' })
  })

  it('grants shared read tools by group and refuses every write by default', () => {
    const config = snapshotConfig(Config({}))
    expect(isReadToolEnabled(config, 'query_types')).toBe(true)
    expect(isReadToolEnabled(config, 'get_ide_context')).toBe(true)
    expect(isReadToolEnabled(config, 'write_localisation')).toBe(false)
    // A name the catalog does not publish is never granted, even when stored as true.
    expect(isReadToolEnabled({ ...config, readTools: { not_a_cwtools_tool: true } }, 'not_a_cwtools_tool')).toBe(false)
    expect(isWriteToolEnabled(config, 'write_localisation')).toBe(false)
    expect(allowedWriteTools(config)).toEqual([])

    const overrides = snapshotConfig(Config({
      readGroups: { semantic: false },
      readTools: { query_rules: false, get_ide_context: true },
      writeTools: { write_localisation: true, deploy_mod_asset: false },
    }))
    expect(isReadToolEnabled(overrides, 'query_types')).toBe(false)
    expect(isReadToolEnabled(overrides, 'get_ide_context')).toBe(true)
    expect(isWriteToolEnabled(overrides, 'write_localisation')).toBe(true)
    expect(allowedWriteTools(overrides)).toEqual(['write_localisation'])
    expect(allowedWriteTools({ ...overrides, enabled: false })).toEqual([])
  })

  it('keeps the group ledger complete for every catalog group', () => {
    const config = snapshotConfig(Config({}))
    expect(Object.keys(config.readGroups)).toEqual(['project', 'localisation', 'semantic', 'navigation', 'diagnostics', 'shader', 'ide'])
    expect(Object.values(config.readGroups).every(Boolean)).toBe(true)
  })

  it('rejects invalid timers, capacities and output limits', () => {
    expect(() => Config({ backend: { requestTimeoutMs: 0 } })).toThrow()
    expect(() => Config({ backend: { maxWorkspaceRuntimes: 0 } })).toThrow()
    expect(() => Config({ output: { maxResultChars: 10 } })).toThrow()
  })

  // The Host serves a settings namespace only when its Config declares volatile fields, so an
  // entry whose controls sit outside a volatile node silently disappears from Settings.
  it('marks every configured field volatile', () => {
    const schema = Config as unknown as SchemaNode
    const hidden = leaves(schema)
      .map(path => path.join('.'))
      .filter(path => !isVolatilePath(schema, path.split('.')))
    expect(hidden).toEqual([])
  })
})