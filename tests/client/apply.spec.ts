/** What the browser half registers, when it registers it, and that it all leaves with the fiber. */

import { describe, expect, it, vi } from 'vitest'
import * as client from '../../src/client/index.ts'
import { apply, inject } from '../../src/client/index.ts'
import { CWTOOLS_READ_TOOL_NAMES } from '../../src/contract/toolCatalog.ts'
import { CwtoolsSection } from '../../src/client/CwtoolsSection.tsx'
import { CwtoolsSectionIcon } from '../../src/client/CwtoolsSectionIcon.tsx'
import { en } from '../../src/client/locales.ts'
import { TestConfigForm } from './fixtures.ts'

/** The dictionary namespace this plugin owns. */
const NS = 'settings.cwtools'

/** One recorded slot registration. */
interface Recorded { key: string; options: Record<string, unknown>; component: unknown }

/**
 * A minimal host for the plugin: the three services it injects, an effect
 * ledger, and a slot ledger that answers `inject` the way the renderer does.
 */
function bench() {
  const recorded: Recorded[] = []
  const declared = new Set<string>(['settings.section', 'settings.section.icon'])
  const effects: { label: string; dispose: () => void }[] = []
  const dictionaries: { ns: string; dictionary: Record<string, unknown> }[] = []
  let served = true
  let registration: (() => void) | undefined
  const watchers: (() => void)[] = []
  const form = new TestConfigForm()
  const configForms = {
    get: vi.fn(() => form),
    whileServed: (namespaces: readonly string[], register: () => () => void) => {
      const sync = () => {
        const watched = namespaces.includes('cwtools') && served
        if (watched && registration === undefined) registration = register()
        else if (!watched && registration !== undefined) {
          registration()
          registration = undefined
        }
      }
      watchers.push(sync)
      sync()
      return () => { registration?.(); registration = undefined }
    },
  }
  const slots = {
    // The renderer runs each injection as a nested effect, so a plugin unload
    // removes the contribution exactly as a declaration collapse would.
    inject: (key: string, callback: () => (() => void) | Iterable<() => void>) => {
      const outer = ctx.effect(() => {
        if (!declared.has(key)) return () => {}
        const effect = callback()
        return typeof effect === 'function' ? effect : () => { for (const dispose of effect) dispose() }
      }, 'slots.inject')
      return outer
    },
    register: (options: Record<string, unknown>, component: unknown) => {
      const entry: Recorded = { key: String(options.name), options, component }
      recorded.push(entry)
      return () => {
        const index = recorded.indexOf(entry)
        if (index >= 0) recorded.splice(index, 1)
      }
    },
  }
  const locale = {
    bind: () => (key: keyof typeof en) => en[key],
    register: (ns: string, dictionary: Record<string, unknown>) => {
      const entry = { ns, dictionary }
      dictionaries.push(entry)
      return () => { dictionaries.splice(dictionaries.indexOf(entry), 1) }
    },
  }
  const ctx = {
    configForms,
    slots,
    locale,
    effect: (run: () => (() => void) | undefined, label?: string) => {
      const dispose = run() ?? (() => {})
      effects.push({ label: label ?? '', dispose })
      return dispose
    },
  }
  return {
    ctx, recorded, dictionaries, form,
    /** Serve or withdraw the Host entry, as the describe mirror would. */
    setServed: (next: boolean) => { served = next; for (const sync of watchers) sync() },
    /** Run every recorded effect teardown. */
    teardown: () => { for (const effect of [...effects].reverse()) effect.dispose() },
  }
}

describe('CWTools client entrypoint', () => {
  it('exports nothing at runtime beyond what cordis loading needs', () => {
    expect(Object.keys(client).sort()).toEqual(['apply', 'inject'])
    expect(typeof client.apply).toBe('function')
    expect(client.inject).toEqual(['slots', 'locale', 'configForms'])
  })
})

describe('CWTools client apply', () => {
  it('declares only the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'configForms'])
  })

  it('registers the dictionary for its own namespace', () => {
    const host = bench()
    apply(host.ctx as never)
    expect(host.dictionaries).toHaveLength(1)
    expect(host.dictionaries[0]?.ns).toBe(NS)
    expect(Object.keys(host.dictionaries[0]?.dictionary ?? {}).sort()).toEqual(['en', 'zh'])
  })

  it('registers the section and a matching navigation icon while the Host serves the entry', () => {
    const host = bench()
    apply(host.ctx as never)
    expect(host.recorded.map(entry => entry.key).sort()).toEqual(['settings.section', 'settings.section.icon'])
    const section = host.recorded.find(entry => entry.key === 'settings.section')
    const icon = host.recorded.find(entry => entry.key === 'settings.section.icon')
    // The nav row and its icon are addressed by one shared id, and the
    // section's copy comes from the namespace this plugin registered.
    expect(section?.options.id).toBe('cwtools')
    expect(icon?.options.id).toBe(section?.options.id)
    expect(section?.options.locale).toBe(host.dictionaries[0]?.ns)
    expect(section?.options.locale).toBe(NS)
    expect(section?.component).toBe(CwtoolsSection)
    expect(icon?.component).toBe(CwtoolsSectionIcon)
    expect((section?.options.label as () => string)()).toBe(en.nav)
  })

  it('binds the section face to the staged controller', () => {
    const host = bench()
    apply(host.ctx as never)
    const section = host.recorded.find(entry => entry.key === 'settings.section')
    const face = (section?.options.inject as () => Record<string, unknown>)()
    expect(Object.keys(face).sort()).toEqual(['discard', 'edit', 'hooks', 'resetField', 'save', 'toggle'])
    expect(face.hooks).toHaveProperty('cwtoolsSection')
  })

  it('leaves no navigation row behind once the Host stops serving the entry', () => {
    const host = bench()
    apply(host.ctx as never)
    expect(host.recorded).toHaveLength(2)
    host.setServed(false)
    expect(host.recorded).toHaveLength(0)
    host.setServed(true)
    expect(host.recorded).toHaveLength(2)
  })

  it('releases the section, its icon, and the form subscription on teardown', () => {
    const host = bench()
    apply(host.ctx as never)
    expect(host.form.listenerCount).toBeGreaterThan(0)
    host.teardown()
    expect(host.form.listenerCount).toBe(0)
    expect(host.recorded).toHaveLength(0)
  })

  it('never offers a tool outside the frozen catalog', () => {
    const host = bench()
    apply(host.ctx as never)
    const section = host.recorded.find(entry => entry.key === 'settings.section')
    const face = (section?.options.inject as () => { hooks: { cwtoolsSection: { getSnapshot(): { fields: Record<string, unknown> } } } })()
    const fields = Object.keys(face.hooks.cwtoolsSection.getSnapshot().fields)
    const offered = fields.filter(field => field.startsWith('readTools.')).map(field => field.slice('readTools.'.length))
    expect(offered.sort()).toEqual([...CWTOOLS_READ_TOOL_NAMES].sort())
    expect(offered).toHaveLength(37)
    const writes = fields.filter(field => field.startsWith('writeTools.'))
    expect(writes).toEqual(['writeTools.write_localisation'])
  })
})