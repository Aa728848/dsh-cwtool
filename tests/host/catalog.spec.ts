import { describe, expect, it } from 'vitest'
import { isMcpToolName, isMcpWriteToolName, listMcpToolSchemas } from 'cwtools-shared'
import {
  cwtoolsCatalogEntry,
  cwtoolsGameModelFor,
  cwtoolsReadGroupFor,
  CWTOOLS_READ_GROUP_ORDER,
  CWTOOLS_READ_TOOL_GROUPS,
  CWTOOLS_READ_TOOL_NAMES,
  CWTOOLS_WRITE_TOOL_NAMES,
  isCwtoolsReadToolName,
  isCwtoolsWriteToolName,
} from '../../src/contract/toolCatalog.ts'

const shared = listMcpToolSchemas({ includeWrites: true }).map(tool => tool.name)

describe('CWTools catalog', () => {
  // The catalog is a projection of cwtools-shared, not a copy of it: a tool added
  // upstream must reach the Host and the settings page with no edit in this package.
  it('publishes every shared tool and nothing else', () => {
    expect([...CWTOOLS_READ_TOOL_NAMES, ...CWTOOLS_WRITE_TOOL_NAMES].sort()).toEqual([...shared].sort())
    expect(new Set([...CWTOOLS_READ_TOOL_NAMES, ...CWTOOLS_WRITE_TOOL_NAMES]).size).toBe(shared.length)
  })

  it('splits reads and writes by the shared registry, not by a local list', () => {
    for (const name of shared) {
      if (isMcpWriteToolName(name)) {
        expect(isCwtoolsWriteToolName(name)).toBe(true)
        expect(isCwtoolsReadToolName(name)).toBe(false)
        expect(CWTOOLS_WRITE_TOOL_NAMES).toContain(name)
      } else {
        expect(isCwtoolsReadToolName(name)).toBe(true)
        expect(isCwtoolsWriteToolName(name)).toBe(false)
        expect(CWTOOLS_READ_TOOL_NAMES).toContain(name)
      }
    }
  })

  it('keeps every read tool in exactly one group, in rendering order', () => {
    const grouped = CWTOOLS_READ_GROUP_ORDER.flatMap(group => [...CWTOOLS_READ_TOOL_GROUPS[group]])
    expect(new Set(grouped).size).toBe(grouped.length)
    expect(grouped).toEqual([...CWTOOLS_READ_TOOL_NAMES])
    for (const name of grouped) expect(cwtoolsCatalogEntry(name)?.group).toBe(cwtoolsReadGroupFor(name))
  })

  it('files IDE bridge reads under their own group', () => {
    expect(CWTOOLS_READ_TOOL_GROUPS.ide).toEqual(['get_ide_context', 'open_in_visual_editor'])
  })

  it('rejects names the shared catalog does not publish', () => {
    expect(isCwtoolsReadToolName('not_a_cwtools_tool')).toBe(false)
    expect(cwtoolsCatalogEntry('not_a_cwtools_tool')).toBeUndefined()
    expect(() => cwtoolsReadGroupFor('not_a_cwtools_tool')).toThrow()
    expect(() => cwtoolsReadGroupFor('write_localisation')).toThrow()
  })

  it('publishes every shared write tool as a write', () => {
    for (const name of shared.filter(name => isMcpWriteToolName(name))) {
      expect(CWTOOLS_WRITE_TOOL_NAMES).toContain(name)
    }
    expect(CWTOOLS_WRITE_TOOL_NAMES).toContain('write_localisation')
    // A registry "none" effect is not a read/answer guarantee: derive reads from
    // the catalog, never from the effect alone.
    expect(isCwtoolsReadToolName('analyze_diagnostic_error')).toBe(true)
  })

  it('keeps the diagnostic and shader tools in their own groups', () => {
    expect(CWTOOLS_READ_TOOL_GROUPS.diagnostics).toEqual(['get_diagnostics', 'analyze_diagnostic_error'])
    expect(CWTOOLS_READ_TOOL_GROUPS.shader).toHaveLength(7)
  })

  it('records the game model a game-only tool requires', () => {
    expect(cwtoolsGameModelFor('query_targeting_weight')).toBe('stellaris')
    expect(cwtoolsGameModelFor('query_types')).toBeUndefined()
    // Every name the table mentions is a real shared tool.
    for (const name of ['query_targeting_weight']) expect(isMcpToolName(name)).toBe(true)
  })
})