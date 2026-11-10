// @vitest-environment jsdom
/** The CWTools page as the settings shell renders it: every control, one save, and the refusal notice. */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { CwtoolsConfig } from '../../src/contract/configTypes.ts'
import { CWTOOLS_READ_TOOL_NAMES } from '../../src/contract/toolCatalog.ts'
import { CwtoolsSettingsController, type CwtoolsSectionState } from '../../src/client/cwtools-controller.ts'
import { CwtoolsSection, type CwtoolsSectionProps } from '../../src/client/CwtoolsSection.tsx'
import { en, zh, type CwtoolsLocaleKey } from '../../src/client/locales.ts'
import { TestConfigForm, defaultConfig } from './fixtures.ts'

afterEach(cleanup)

/**
 * Bind one selector hook over a snapshot store, as the slot renderer does: the
 * component receives `use<Name>(selector)` and re-renders on every publish.
 * @param store - the published section store.
 * @returns the selector hook the section props carry.
 */
function selectorHook<T>(store: SnapshotStore<T>) {
  return (selector: (value: T) => unknown) => useSyncExternalStore(
    store.subscribe,
    () => selector(store.getSnapshot()),
    () => selector(store.getSnapshot()),
  )
}

/** Render the section over a real form fixture, returning what the props drive. */
function renderSection(options: {
  config?: CwtoolsConfig
  user?: unknown
  locale?: 'en' | 'zh'
  writable?: boolean
  prepare?: (face: ReturnType<CwtoolsSettingsController['inject']>) => void
} = {}) {
  const form = new TestConfigForm(options.config ?? defaultConfig(), options.user)
  if (options.writable === false) form.getSnapshot().writable = false
  const controller = new CwtoolsSettingsController(form)
  const face = controller.inject()
  options.prepare?.(face)
  const dictionary = options.locale === 'zh' ? zh : en
  const t = (key: CwtoolsLocaleKey) => dictionary[key]
  const props = {
    close: vi.fn(),
    ...face,
    useCwtoolsSection: selectorHook(face.hooks.cwtoolsSection),
    t,
  } as unknown as CwtoolsSectionProps
  render(<CwtoolsSection {...props} />)
  return { controller, form, face, t }
}

/** Select one settings tab, as a user switching categories does. */
function openTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

describe('CwtoolsSection rendering', () => {
  it('renders the master switch, both backend groups, and the read/write/output blocks', () => {
    renderSection()
    expect(screen.getByRole('heading', { level: 2, name: en.title })).toBeTruthy()
    expect(screen.getByRole('switch', { name: en.enabled }).getAttribute('aria-checked')).toBe('true')
    openTab(en.tabBackend)
    expect(screen.getByLabelText(en.serverPath)).toHaveProperty('value', '')
    expect(screen.getByLabelText(en.maxWorkspaceRuntimes)).toHaveProperty('value', '2')
    openTab(en.tabOutput)
    expect(screen.getByLabelText(en.maxResultChars)).toHaveProperty('value', '16000')
    expect(screen.getByRole('switch', { name: en.writeLocalisation }).getAttribute('aria-checked')).toBe('false')
  })

  it('renders exactly the six groups and 37 shipped tools, and nothing this release does not ship', () => {
    renderSection()
    openTab(en.tabRead)
    const groups = [en.groupProject, en.groupLocalisation, en.groupSemantic, en.groupNavigation, en.groupDiagnostics, en.groupShader]
    for (const group of groups) expect(screen.getAllByRole('switch', { name: group })).toHaveLength(1)
    expect(screen.getAllByRole('switch')).toHaveLength(1 + 6 + CWTOOLS_READ_TOOL_NAMES.length)
    for (const tool of CWTOOLS_READ_TOOL_NAMES) expect(screen.getByRole('switch', { name: tool })).toBeTruthy()
    expect(document.body.textContent).not.toContain('write_file')
    expect(document.body.textContent).not.toContain('ide_')
  })

  it('renders the diagnostic filter controls and stages the workspace noise settings', async () => {
    const { form } = renderSection()
    openTab(en.tabRead)
    fireEvent.change(screen.getByLabelText(en.ignoreCodes), { target: { value: 'CW274, CW288' } })
    fireEvent.change(screen.getByLabelText(en.ignoreFiles), { target: { value: 'zz_legacy.txt' } })
    fireEvent.click(screen.getByRole('tab', { name: en.localisationFilterAll }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.save })) })
    expect(form.writes[0]?.ops).toEqual([
      { op: 'set', path: ['diagnostics', 'ignoreCodes'], value: ['CW274', 'CW288'] },
      { op: 'set', path: ['diagnostics', 'ignoreFiles'], value: ['zz_legacy.txt'] },
      { op: 'set', path: ['diagnostics', 'localisationFilter'], value: 'all' },
    ])
  })

  it('renders the Chinese dictionary when the shell is in Chinese', () => {
    renderSection({ locale: 'zh' })
    expect(screen.getByRole('heading', { level: 2, name: zh.title })).toBeTruthy()
    openTab(zh.tabBackend)
    expect(screen.getByLabelText(zh.serverPath)).toBeTruthy()
    openTab(zh.tabRead)
    expect(screen.getByRole('switch', { name: zh.groupShader })).toBeTruthy()
  })
})

describe('CwtoolsSection editing', () => {
  it('stages a path and a bound, and saves them in one write', async () => {
    const { form } = renderSection()
    openTab(en.tabBackend)
    fireEvent.change(screen.getByLabelText(en.serverPath), { target: { value: 'C:/cwtools.exe' } })
    openTab(en.tabOutput)
    fireEvent.change(screen.getByLabelText(en.maxResultChars), { target: { value: '24000' } })
    expect(screen.getByRole('button', { name: en.save })).toHaveProperty('disabled', false)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.save })) })
    expect(form.writes).toHaveLength(1)
    expect(form.writes[0]?.ops).toEqual([
      { op: 'set', path: ['backend', 'serverPath'], value: 'C:/cwtools.exe' },
      { op: 'set', path: ['output', 'maxResultChars'], value: 24000 },
    ])
  })

  it('disables the tools of a group it turns off and keeps their values', () => {
    renderSection()
    openTab(en.tabRead)
    const group = screen.getByRole('switch', { name: en.groupShader })
    fireEvent.click(group)
    expect(group.getAttribute('aria-checked')).toBe('false')
    const tool = screen.getByRole('switch', { name: 'query_shader_symbol' })
    expect((tool as HTMLButtonElement).disabled).toBe(true)
    expect(tool.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(group)
    expect((screen.getByRole('switch', { name: 'query_shader_symbol' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('refuses an out-of-range bound without staging a write', async () => {
    const { form } = renderSection()
    openTab(en.tabBackend)
    fireEvent.change(screen.getByLabelText(en.maxWorkspaceRuntimes), { target: { value: '99' } })
    const input = screen.getByLabelText(en.maxWorkspaceRuntimes)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(en.invalidNumber)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.save })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    expect(form.writes).toHaveLength(0)
  })

  it('clears a stored override through the reset control', async () => {
    const config = defaultConfig()
    config.backend.game = 'ck3'
    const { form } = renderSection({ config, user: { backend: { game: 'ck3' }, output: {} } })
    fireEvent.click(screen.getByRole('button', { name: en.reset }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.save })) })
    expect(form.writes[0]?.ops).toEqual([{ op: 'unset', path: ['backend', 'game'] }])
  })
})

describe('CwtoolsSection failure surfaces', () => {
  it('keeps the draft and shows the accepted value when the Host refuses', async () => {
    const { form } = renderSection()
    form.verdicts = ['refuse']
    fireEvent.change(screen.getByLabelText(en.game), { target: { value: 'ck3' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.save })) })
    expect(screen.getByRole('alert').textContent).toContain(en.failedTitle)
    expect(screen.getByText(en.acceptedValue)).toBeTruthy()
    expect(screen.getByLabelText(en.game)).toHaveProperty('value', 'ck3')
    expect(screen.getByRole('button', { name: en.save })).toHaveProperty('disabled', false)
  })

  it('names a revision conflict separately from a refusal and keeps the draft', async () => {
    const { form } = renderSection()
    form.verdicts = ['conflict']
    fireEvent.change(screen.getByLabelText(en.game), { target: { value: 'ck3' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.save })) })
    expect(screen.getByText(en.conflictNotice)).toBeTruthy()
    expect(screen.getByLabelText(en.game)).toHaveProperty('value', 'ck3')
  })

  it('drops every draft when the page unmounts', () => {
    const { form } = renderSection()
    fireEvent.change(screen.getByLabelText(en.game), { target: { value: 'ck3' } })
    expect(screen.getByRole('button', { name: en.save })).toHaveProperty('disabled', false)
    cleanup()
    expect(form.writes).toHaveLength(0)
  })

  it('locks every control on a read-only document', () => {
    renderSection({ writable: false })
    expect(screen.getByRole('status').textContent).toBe(en.readOnly)
    for (const control of screen.getAllByRole('switch')) expect((control as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByLabelText(en.game)).toHaveProperty('disabled', true)
  })

  it('says the plugin is not loaded instead of showing fields nothing would accept', () => {
    const form = new TestConfigForm()
    form.withdraw()
    const controller = new CwtoolsSettingsController(form)
    const face = controller.inject()
    const props = {
      close: vi.fn(),
      ...face,
      useCwtoolsSection: selectorHook(face.hooks.cwtoolsSection),
      t: (key: CwtoolsLocaleKey) => en[key],
    } as unknown as CwtoolsSectionProps
    render(<CwtoolsSection {...props} />)
    expect(screen.getByRole('status').textContent).toBe(en.unavailable)
    expect(screen.queryByLabelText(en.game)).toBeNull()
  })
})