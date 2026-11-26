import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CWTOOLS_SYSTEM_PROMPT } from '../../src/host/prompt.ts'

const prompt = CWTOOLS_SYSTEM_PROMPT
const DRIVE_LETTER = /[A-Za-z]:[\\/]/

describe('CWTools system prompt - visual editors', () => {
  it('routes 3D/visual editors through open_in_visual_editor with the full enum', () => {
    expect(prompt).toContain('open_in_visual_editor')
    for (const editor of ['auto', 'gui', 'entity', 'particle', 'solar_system', 'tech_tree', 'event_chain', 'target_weight']) {
      expect(prompt).toContain(editor)
    }
  })

  it('marks the Ship Design Workbench and Static Galaxy Editor as VS Code entries, not tool enum values', () => {
    expect(prompt).toContain('Ship Design Workbench')
    expect(prompt).toContain('Static Galaxy Editor')
    expect(prompt).toMatch(/NOT in the open_in_visual_editor enum/i)
  })

  it('states read-only protection: mod copy, never the game directory, undoable', () => {
    expect(prompt).toMatch(/read-only/i)
    expect(prompt).toMatch(/never write the game directory/i)
    expect(prompt).toMatch(/undoable/i)
  })
})

describe('CWTools system prompt - particle reverse lookup', () => {
  it('keeps the entity event.particle -> pdxparticle proxy -> type -> .asset definition chain', () => {
    expect(prompt).toContain('event.particle')
    expect(prompt).toContain('gfx/particles')
    expect(prompt).toContain('pdxparticle')
    expect(prompt).toMatch(/pdxparticle = \{ name, type, scale \}/)
    expect(prompt).toMatch(/animation \{ \.\.\. \} force \{ \.\.\. \}/)
  })

  it('keeps subsystem curve references and the CWT rule paths', () => {
    expect(prompt).toContain('subsystem')
    expect(prompt).toContain('curveName')
    expect(prompt).toContain('particles.cwt')
    expect(prompt).toContain('model_entities.cwt')
  })

  it('keeps entity/mesh/locator/material relations', () => {
    for (const token of ['pdxmesh', 'meshsettings', 'texture_', 'locator', 'attach', 'ship_sizes', '*.anim']) {
      expect(prompt).toContain(token)
    }
  })

  it('declares previews as runtime approximations, not engine truth', () => {
    expect(prompt).toMatch(/runtime approximations/i)
    expect(prompt).toMatch(/approximate simulation/i)
    expect(prompt).toMatch(/k-nearest-neighbor estimate/i)
    expect(prompt).toMatch(/never written back/i)
    expect(prompt).toMatch(/never present unverified engine internals as fact/i)
  })
})

describe('CWTools system prompt - path portability and grounding', () => {
  it('never hardcodes a drive letter for the vanilla install', () => {
    expect(prompt).not.toMatch(DRIVE_LETTER)
  })

  it('tells the Agent not to assume vanilla exists or a fixed drive', () => {
    expect(prompt).toMatch(/do not assume a fixed drive letter/i)
    expect(prompt).toMatch(/that vanilla exists/i)
  })

  it('keeps the pre-existing grounding rules intact', () => {
    for (const token of ['explore_pdx_project', 'query_cwt_schema', 'readiness.ready', 'vanillaCache', 'whitelisted', 'Never treat a denied write as completed']) {
      expect(prompt).toContain(token)
    }
  })
})

describe('visual-editors-and-particles guide', () => {
  const doc = readFileSync(new URL('../../docs/visual-editors-and-particles.md', import.meta.url), 'utf8')

  it('covers every visual editor and the reverse-lookup chain', () => {
    for (const token of ['舰船设计工作台', '恒星系预览', '静态银河', '实体预览', '粒子预览', 'pdxparticle', 'particle_type', 'locator', 'attach', 'pdxmesh', '运行时近似']) {
      expect(doc).toContain(token)
    }
  })

  it('does not bake a specific install drive into the guide', () => {
    expect(doc).not.toMatch(DRIVE_LETTER)
  })

  it('covers independent Ship and Galaxy candidate grants', () => {
    for (const token of ['ship_design_draft', 'static_galaxy_draft', 'do not require candidate_transaction', 'never claim an apply changed disk']) expect(prompt).toContain(token)
  })

  it('points at the CWT rule paths and vanilla relative paths', () => {
    expect(doc).toContain('config/gfx/particles.cwt')
    expect(doc).toContain('config/gfx/model_entities.cwt')
    expect(doc).toContain('gfx/particles/**/*.gfx')
    expect(doc).toContain('gfx/particles/**/*.asset')
  })
})