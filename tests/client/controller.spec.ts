/** What the CWTools section stages, what one save writes, and what a refusal keeps. */

import { describe, expect, it } from 'vitest'
import { CWTOOLS_READ_TOOL_NAMES } from '../../src/contract/toolCatalog.ts'
import { CWTOOLS_SETTINGS_NAMESPACE, CwtoolsSettingsController } from '../../src/client/cwtools-controller.ts'
import { TestConfigForm, defaultConfig } from './fixtures.ts'

/** Bind a controller to a fresh fake Host entry. */
function bench(config = defaultConfig()) {
  const form = new TestConfigForm(config)
  const controller = new CwtoolsSettingsController(form)
  return { form, controller, state: () => controller.inject().hooks.cwtoolsSection.getSnapshot() }
}

describe('CwtoolsSettingsController defaults', () => {
  it('addresses the Host entry the frozen contract declares', () => {
    expect(CWTOOLS_SETTINGS_NAMESPACE).toBe('cwtools')
  })

  it('renders every shipped read tool and both write states from the accepted section', () => {
    const { state } = bench()
    const current = state()
    // master switch + backend text/number/switch fields + diagnostic lists/filter
    // + read groups + read tools + write + output
    expect(Object.keys(current.fields)).toHaveLength(1 + 5 + 2 + 4 + 3 + 6 + CWTOOLS_READ_TOOL_NAMES.length + 1 + 1 + 2)
    for (const tool of CWTOOLS_READ_TOOL_NAMES) expect(current.tools[tool]).toBe(true)
    expect(current.fields['writeTools.write_localisation']?.text).toBe('false')
    expect(current.fields['backend.serverPath']?.text).toBe('')
    expect(current.fields['backend.maxWorkspaceRuntimes']?.text).toBe('2')
    expect(current.fields['output.maxResultChars']?.text).toBe('16000')
    expect(current.available).toBe(true)
    expect(current.writable).toBe(true)
    expect(current.dirty).toBe(false)
  })

  it('shows the accepted values the Host resolved for a configured deployment', () => {
    const config = defaultConfig()
    config.backend.serverPath = 'C:/cwtools/cwtools.exe'
    config.backend.game = 'stellaris'
    config.writeTools = { write_localisation: true }
    const { state } = bench(config)
    expect(state().fields['backend.serverPath']?.text).toBe('C:/cwtools/cwtools.exe')
    expect(state().fields['backend.game']?.text).toBe('stellaris')
    expect(state().fields['writeTools.write_localisation']?.text).toBe('true')
  })

  it('reports an unavailable namespace instead of pretending to be configurable', () => {
    const { form, state } = bench()
    form.withdraw()
    expect(state().available).toBe(false)
  })
})

describe('CwtoolsSettingsController tool grants', () => {
  it('keeps every per-tool value while its group is off', () => {
    const { controller, state } = bench()
    controller.inject().toggle('readGroups.shader', false)
    const current = state()
    expect(current.groups.shader).toBe(false)
    expect(current.tools.query_shader_symbol).toBe(false)
    expect(current.fields['readTools.query_shader_symbol']?.text).toBe('true')
    expect(current.fields['readGroups.shader']?.overridden).toBe(true)
  })

  it('restores the grants a group had when it is turned back on', () => {
    const { controller, state } = bench()
    controller.inject().toggle('readGroups.shader', false)
    controller.inject().toggle('readGroups.shader', true)
    expect(state().tools.query_shader_symbol).toBe(true)
  })

  it('leaves a single tool off when only that tool is withdrawn', () => {
    const { controller, state } = bench()
    controller.inject().toggle('readTools.get_diagnostics', false)
    const current = state()
    expect(current.tools.get_diagnostics).toBe(false)
    expect(current.groups.diagnostics).toBe(true)
    expect(current.tools.analyze_diagnostic_error).toBe(true)
    expect(current.dirty).toBe(true)
  })
})

describe('CwtoolsSettingsController saves', () => {
  it('writes every staged control in one revision-fenced mutation', async () => {
    const { controller, form, state } = bench()
    const face = controller.inject()
    face.toggle('readGroups.navigation', false)
    face.edit('backend.serverPath', 'D:/bin/cwtools.exe')
    face.edit('output.maxResultChars', '32000')
    face.save()
    await Promise.resolve()
    await Promise.resolve()
    expect(form.writes).toHaveLength(1)
    expect(form.writes[0]?.revision).toBe(1)
    expect(form.writes[0]?.ops).toEqual([
      { op: 'set', path: ['readGroups', 'navigation'], value: false },
      { op: 'set', path: ['backend', 'serverPath'], value: 'D:/bin/cwtools.exe' },
      { op: 'set', path: ['output', 'maxResultChars'], value: 32000 },
    ])
    expect(state().dirty).toBe(false)
    expect(form.getSnapshot().value?.readGroups.navigation).toBe(false)
    expect(form.getSnapshot().value?.backend.serverPath).toBe('D:/bin/cwtools.exe')
  })

  it('clears a stored override with an unset rather than writing a default', async () => {
    const config = defaultConfig()
    config.backend.startupTimeoutMs = 45_000
    const form = new TestConfigForm(config, { backend: { startupTimeoutMs: 45_000 }, output: {} })
    const controller = new CwtoolsSettingsController(form)
    controller.inject().resetField('backend.startupTimeoutMs')
    controller.inject().save()
    await Promise.resolve()
    await Promise.resolve()
    expect(form.writes[0]?.ops).toEqual([{ op: 'unset', path: ['backend', 'startupTimeoutMs'] }])
  })

  it('writes the single shipped write tool and never another', async () => {
    const { controller, form } = bench()
    controller.inject().toggle('writeTools.write_localisation', true)
    controller.inject().save()
    await Promise.resolve()
    await Promise.resolve()
    expect(form.writes[0]?.ops).toEqual([{ op: 'set', path: ['writeTools', 'write_localisation'], value: true }])
  })

  it('stages nothing when the document holds an unwritable value', () => {
    const { controller, state } = bench()
    controller.inject().edit('backend.maxWorkspaceRuntimes', '12')
    expect(state().fields['backend.maxWorkspaceRuntimes']?.invalid).toBe(true)
    expect(state().invalid).toBe(true)
  })
})

describe('CwtoolsSettingsController refusals', () => {
  it('keeps the drafts and reports the values the Host accepted after a refusal', async () => {
    const { controller, form, state } = bench()
    form.verdicts = ['refuse']
    controller.inject().edit('backend.game', 'ck3')
    controller.inject().save()
    await Promise.resolve()
    await Promise.resolve()
    const current = state()
    expect(current.failed).toBe(true)
    expect(current.conflict).toBe(false)
    expect(current.fields['backend.game']?.text).toBe('ck3')
    expect(current.accepted).toEqual([{ field: 'backend.game', text: '' }])
  })

  it('separates a revision conflict from a refused value', async () => {
    const { controller, form, state } = bench()
    form.verdicts = ['conflict']
    controller.inject().edit('backend.game', 'ck3')
    controller.inject().save()
    await Promise.resolve()
    await Promise.resolve()
    const current = state()
    expect(current.failed).toBe(true)
    expect(current.conflict).toBe(true)
    expect(current.fields['backend.game']?.text).toBe('ck3')
  })

  it('reports a transport failure as a failed save and keeps the draft', async () => {
    const { controller, form, state } = bench()
    form.transportFailure = new Error('socket closed')
    controller.inject().edit('backend.game', 'ck3')
    controller.inject().save()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(state().failed).toBe(true)
    expect(state().fields['backend.game']?.text).toBe('ck3')
  })

  it('drops every draft on discard, leaving the accepted section alone', () => {
    const { controller, form, state } = bench()
    const face = controller.inject()
    face.edit('backend.game', 'ck3')
    expect(state().dirty).toBe(true)
    face.discard()
    expect(state().dirty).toBe(false)
    expect(state().fields['backend.game']?.text).toBe('')
    expect(form.writes).toHaveLength(0)
  })
})

describe('CwtoolsSettingsController read-only deployments', () => {
  it('refuses to save and reports the document as unwritable', async () => {
    const form = new TestConfigForm()
    form.getSnapshot().writable = false
    const controller = new CwtoolsSettingsController(form)
    const state = () => controller.inject().hooks.cwtoolsSection.getSnapshot()
    controller.inject().edit('backend.game', 'ck3')
    expect(state().writable).toBe(false)
    controller.inject().save()
    await Promise.resolve()
    expect(form.writes).toHaveLength(0)
  })
})

describe('CwtoolsSettingsController teardown', () => {
  it('releases its subscription so a disposed page cannot republish', () => {
    const form = new TestConfigForm()
    const controller = new CwtoolsSettingsController(form)
    expect(form.listenerCount).toBeGreaterThan(0)
    controller.dispose()
    expect(form.listenerCount).toBe(0)
  })
})