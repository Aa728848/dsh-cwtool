import { describe, expect, it } from 'vitest'
import {
  CWTOOLS_FIRST_RELEASE_TOOL_NAMES,
  CWTOOLS_READ_TOOL_GROUPS,
  CWTOOLS_READ_TOOL_NAMES,
  CWTOOLS_WRITE_TOOL_NAMES,
} from '../../src/contract/toolCatalog.ts'

 describe('CWTools first-release catalog', () => {
  it('contains 37 read tools and one write without duplicates', () => {
    expect(CWTOOLS_READ_TOOL_NAMES).toHaveLength(37)
    expect(CWTOOLS_WRITE_TOOL_NAMES).toEqual(['write_localisation'])
    expect(CWTOOLS_FIRST_RELEASE_TOOL_NAMES).toHaveLength(38)
    expect(new Set(CWTOOLS_FIRST_RELEASE_TOOL_NAMES).size).toBe(38)
  })

  it('keeps every read tool in exactly one configured group', () => {
    const grouped = Object.values(CWTOOLS_READ_TOOL_GROUPS).flatMap(tools => [...tools])
    expect(grouped).toHaveLength(37)
    expect(new Set(grouped).size).toBe(37)
    expect(grouped).toEqual([...CWTOOLS_READ_TOOL_NAMES])
  })

  it('excludes VS Code-only tools and unsupported domain writes', () => {
    for (const name of [
      'get_ide_context', 'open_in_visual_editor', 'typed_pdx_write',
      'candidate_transaction', 'convert_image_to_dds', 'convert_audio', 'deploy_mod_asset',
    ]) expect(CWTOOLS_FIRST_RELEASE_TOOL_NAMES).not.toContain(name)
  })
})
